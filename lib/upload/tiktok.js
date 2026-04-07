/**
 * lib/upload/tiktok.js — TikTok Creator API uploader
 * Supports OAuth token exchange + auto-refresh.
 * Requires in .env: TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Registry } from '../registry.js';

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
const TIKTOK_API = 'https://open.tiktokapis.com/v2';
const TOKEN_URL = TIKTOK_API + '/oauth/token/';
const CLIENT_ID = env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = env.TIKTOK_CLIENT_SECRET;

/**
 * Exchange an auth code (from OAuth redirect) for access + refresh tokens.
 * @param {string} code - Auth code from TikTok OAuth redirect
 * @param {string} redirectUri - Must match the redirect URI registered in TikTok app settings
 */
export async function exchangeAuthCode(code, redirectUri) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!r.ok) throw new Error('TikTok auth code exchange failed: ' + r.status + ' ' + await r.text());
  return r.json(); // { access_token, refresh_token, expires_in, open_id, scope }
}

/**
 * Refresh an expired access token using the refresh token.
 * @param {string} refreshToken - Optional; defaults to TIKTOK_REFRESH_TOKEN from .env
 */
export async function refreshAccessToken(refreshToken = env.TIKTOK_REFRESH_TOKEN) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!r.ok) throw new Error('TikTok token refresh failed: ' + r.status + ' ' + await r.text());
  return r.json();
}

/**
 * Build the OAuth authorization URL for user consent.
 * @param {string} redirectUri - Must match TikTok app registered redirect URI
 * @param {string} state - CSRF state token (default: 'tkp-upload')
 */
export function getAuthUrl(redirectUri, state = 'tkp-upload') {
  const scopes = [
    'video.upload',
    'video.publish',
    'video.manage',
    'user.info.basic',
  ].join(',');
  const params = new URLSearchParams({
    client_key: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

export class TikTokUploader {
  constructor({ accessToken = env.TIKTOK_ACCESS_TOKEN, refreshToken = env.TIKTOK_REFRESH_TOKEN } = {}) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * Upload and publish a video to TikTok.
   *
   * @param {object}   opts
   * @param {string}   opts.videoPath       — Local path to MP4 video
   * @param {string}   opts.title          — Video title/description
   * @param {string}   [opts.description]  — Additional description (max 2200)
   * @param {string[]} [opts.tags]         — Hashtags (TikTok treats as search terms)
   * @param {string}   [opts.thumbnailPath] — Local JPEG thumbnail path (poster frame)
   * @param {Function} [opts.onProgress]   — Called with { phase, progress 0-1, message }
   * @param {string}   [opts.registryId]    — Video ID to record in production registry (e.g. "PW-01")
   *
   * @returns {Promise<object>} — TikTok API response or { success, error }
   */
  async upload({ videoPath, title, description = '', tags = [], thumbnailPath, onProgress, registryId }) {
    const log = onProgress ?? (() => {});

    if (!this.accessToken && !this.refreshToken) {
      throw new Error(
        'TikTok not authenticated. Run `node scripts/oauth-tiktok.js` to complete OAuth setup, ' +
        'or set TIKTOK_ACCESS_TOKEN in .env.'
      );
    }

    // Auto-refresh if no access token (assume expired)
    let token = this.accessToken;
    if (!token) {
      log({ phase: 'auth', progress: 0.05, message: 'Refreshing TikTok access token...' });
      const refreshed = await refreshAccessToken(this.refreshToken);
      token = refreshed.access_token;
      this.accessToken = token;
      this.refreshToken = refreshed.refresh_token || this.refreshToken;
      log({ phase: 'auth', progress: 0.10, message: 'Token refreshed.' });
    }

    // Phase 1: Init
    log({ phase: 'init', progress: 0.10, message: 'Initiating TikTok upload...' });
    const initRes = await fetch(TIKTOK_API + '/video/upload/init/', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_type: 'upload', source: 'FILE_UPLOAD' }),
    });
    if (!initRes.ok) throw new Error('TikTok init failed: ' + initRes.status + ' ' + await initRes.text());
    const { upload_url, upload_id } = await initRes.json();

    // Phase 2: Upload video bytes
    const videoBuffer = readFileSync(videoPath);
    const totalBytes  = videoBuffer.length;

    log({ phase: 'upload', progress: 0.15, message: `Uploading video (${(totalBytes / 1024 / 1024).toFixed(1)} MB)...` });
    const videoRes = await fetch(upload_url, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: videoBuffer,
    });
    if (!videoRes.ok) throw new Error('TikTok video upload failed: ' + videoRes.status);

    // Estimate progress: 15% init + 60% upload + 15% publish + 10% done
    log({ phase: 'upload', progress: 0.75, message: 'Video uploaded, publishing...' });

    // Phase 3: Publish
    log({ phase: 'publish', progress: 0.80, message: 'Publishing to TikTok...' });
    const publishPayload = {
      upload_id,
      title:       (title || '').slice(0, 2200),
      description: (description || '').slice(0, 2200),
      tags:        Array.isArray(tags) ? tags.slice(0, 30) : [],
    };

    // TikTok poster/cover image (thumbnail) — if provided, convert to base64
    if (thumbnailPath) {
      try {
        const thumb = readFileSync(thumbnailPath);
        publishPayload.cover_image_url = `data:image/jpeg;base64,${thumb.toString('base64')}`;
      } catch {
        // Non-fatal — skip thumbnail
      }
    }

    const publishRes = await fetch(TIKTOK_API + '/video/publish/', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(publishPayload),
    });

    if (!publishRes.ok) {
      const txt = await publishRes.text();
      throw new Error('TikTok publish failed: ' + publishRes.status + ' — ' + txt);
    }

    const result = await publishRes.json();
    log({ phase: 'done', progress: 1.0, message: 'Published to TikTok.' });

    // Record successful upload in production registry
    if (registryId) {
      try {
        const reg = new Registry();
        const tiktokVideoId = result.publish_id || result.video_id || null;
        const tiktokUrl = tiktokVideoId ? `https://www.tiktok.com/@user/video/${tiktokVideoId}` : null;
        reg.recordUpload({ id: registryId, platform: 'tiktok', url: tiktokUrl, videoId: tiktokVideoId });
      } catch (err) {
        console.warn(`[TikTokUploader] registry record failed: ${err.message}`);
      }
    }

    return { ...result, success: true, platform: 'tiktok' };
  }
}
