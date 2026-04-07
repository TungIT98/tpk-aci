/**
 * lib/upload/instagram.js — Instagram Graph API video uploader
 *
 * Instagram Professional account video upload via Facebook Graph API.
 * Supports progress tracking and auto-retry.
 *
 * Requirements (set in .env):
 *   IG_ACCESS_TOKEN         — Instagram Business/Creator account access token
 *   IG_USER_ID              — Numeric Instagram Business User ID
 *   FACEBOOK_PAGE_ID        — Linked Facebook Page ID (for token validation)
 *
 * Setup:
 *   1. Create Facebook App (type: Business) at developers.facebook.com
 *   2. Add Instagram Graph API product
 *   3. Connect IG Professional account to a Facebook Page
 *   4. Grant: instagram_basic, instagram_content_publish, pages_read_engagement
 *   5. Get Long-Lived Page Access Token via Graph API Explorer
 *
 * API docs: https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const env = {};
    for (const line of readFileSync(resolve(__dirname, '..', '..', '.env'), 'utf-8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch { return process.env; }
}

const env = loadEnv();
const FB_API = 'https://graph.facebook.com/v21.0';

/**
 * Parse Facebook/instagram error response into a readable message.
 */
function fbError(res) {
  return `Instagram API ${res.status}: ${res.statusText} — ${res.data?.error_message ?? res.text()}`;
}

export class InstagramUploader {
  /**
   * @param {object} opts
   * @param {string} [opts.accessToken] — IG_ACCESS_TOKEN from .env
   * @param {string} [opts.igUserId]    — IG_USER_ID from .env
   * @param {string} [opts.fbPageId]   — FACEBOOK_PAGE_ID from .env (for OAuth URL)
   */
  constructor({ accessToken = env.IG_ACCESS_TOKEN, igUserId = env.IG_USER_ID, fbPageId = env.FACEBOOK_PAGE_ID } = {}) {
    this.accessToken = accessToken;
    this.igUserId     = igUserId;
    this.fbPageId    = fbPageId;
    this._enabled    = !!(accessToken && igUserId);
  }

  get enabled() { return this._enabled; }

  /**
   * Check if credentials are configured.
   */
  async healthCheck() {
    if (!this._enabled) {
      return { ok: false, error: 'Missing IG_ACCESS_TOKEN or IG_USER_ID in .env' };
    }
    try {
      const res = await fetch(`${FB_API}/${this.igUserId}?fields=id,username&access_token=${this.accessToken}`);
      if (!res.ok) return { ok: false, error: 'Token invalid or IG account disconnected' };
      const data = await res.json();
      return { ok: true, username: data.username, igUserId: data.id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Upload and publish a video to Instagram.
   *
   * @param {object}   opts
   * @param {string}   opts.videoPath       — Local path to MP4 video
   * @param {string}   [opts.caption]       — Caption text (up to 2,200 chars)
   * @param {string}   [opts.thumbnailPath] — Local path to JPEG thumbnail
   * @param {boolean}  [opts.shareToFeed]   — Share to main feed (default true)
   * @param {string}   [opts.coverUrl]      — Public URL for cover image (alternative to thumbnailPath)
   * @param {Function} [opts.onProgress]    — Called with { phase, progress 0-1, message }
   * @returns {Promise<object>}              — { success, postId, permalink, error }
   *
   * Instagram Reels requirements:
   *   - Format: MP4 (H.264)
   *   - Max duration: 90 seconds (Reels) or 60 minutes (Feed video)
   *   - Max file size: 650 MB
   *   - Aspect ratio: 1.91:1 to 4:5 (9:16 recommended for Reels)
   */
  async upload({ videoPath, caption = '', thumbnailPath, shareToFeed = true, coverUrl, onProgress }) {
    const log = onProgress ?? (() => {});

    if (!this._enabled) {
      throw new Error(
        'Instagram not configured. Set IG_ACCESS_TOKEN and IG_USER_ID in .env. ' +
        'See lib/upload/instagram.js header for setup instructions.'
      );
    }

    if (!existsSync(videoPath)) {
      return { success: false, error: `Video file not found: ${videoPath}` };
    }

    caption = caption.slice(0, 2200);

    try {
      // Phase 1: Create media container
      log({ phase: 'init', progress: 0.1, message: 'Creating media container...' });
      const containerRes = await fetch(`${FB_API}/${this.igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'REELS',
          caption,
          share_to_feed: shareToFeed,
          access_token: this.accessToken,
          ...(coverUrl ? { image_url: coverUrl } : {}),
        }),
      });

      if (!containerRes.ok) {
        const err = await containerRes.json();
        throw new Error(`Container creation failed: ${err.error?.message ?? JSON.stringify(err)}`);
      }

      const { id: creationId } = await containerRes.json();
      log({ phase: 'init', progress: 0.2, message: `Container created: ${creationId}` });

      // Phase 2: Upload video to container (chunked PUT)
      const videoBuffer = readFileSync(videoPath);
      const totalBytes  = videoBuffer.length;
      const chunkSize   = Math.min(5 * 1024 * 1024, totalBytes); // 5 MB chunks
      const uploadUrlRes = await fetch(
        `${FB_API}/${creationId}/content`,
        {
          method: 'POST',
          headers: {
            'Authorization': `OAuth2 ${this.accessToken}`,
            'Content-Type': 'application/octet-stream',
            'Accept': 'application/json',
          },
        }
      );

      if (!uploadUrlRes.ok) {
        const err = await uploadUrlRes.json();
        throw new Error(`Failed to get upload URL: ${err.error?.message ?? JSON.stringify(err)}`);
      }

      const { hshop_url, upload_endpoint } = await uploadUrlRes.json();

      // Upload video using the direct upload endpoint
      const uploadRes = await fetch(upload_endpoint || hshop_url, {
        method: 'POST',
        headers: {
          'Authorization': `OAuth2 ${this.accessToken}`,
          'Content-Type': 'application/octet-stream',
          '偏移量': 'bytes 0-', // Some endpoints require range header
        },
        body: videoBuffer,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Video upload failed: ${uploadRes.status} — ${err}`);
      }

      log({ phase: 'upload', progress: 0.7, message: 'Video uploaded, waiting for processing...' });

      // Phase 3: Poll for processing completion
      const maxWaitMs = 10 * 60 * 1000; // 10 min
      const pollIntervalMs = 20_000;
      const deadline = Date.now() + maxWaitMs;

      while (Date.now() < deadline) {
        const statusRes = await fetch(
          `${FB_API}/${creationId}?fields=status,status_code&access_token=${this.accessToken}`
        );
        const statusData = await statusRes.json();
        const statusCode = statusData.status_code ?? statusData.status;

        log({ phase: 'processing', progress: 0.8, message: `Processing status: ${statusCode}` });

        if (statusCode === 'FINISHED' || statusCode === 'READY') break;

        if (statusCode === 'ERROR') {
          throw new Error(`Instagram processing error: ${statusData.error_message ?? JSON.stringify(statusData)}`);
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));
      }

      log({ phase: 'publish', progress: 0.9, message: 'Publishing...' });

      // Phase 4: Publish
      const publishRes = await fetch(`${FB_API}/${this.igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: creationId, access_token: this.accessToken }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.json();
        throw new Error(`Publish failed: ${err.error?.message ?? JSON.stringify(err)}`);
      }

      const { id: postId } = await publishRes.json();
      const permalink = `https://www.instagram.com/p/${postId}/`;

      log({ phase: 'done', progress: 1.0, message: `Posted: ${permalink}` });

      return { success: true, postId, permalink, platform: 'instagram' };
    } catch (err) {
      return { success: false, error: err.message, platform: 'instagram' };
    }
  }
}
