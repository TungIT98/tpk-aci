/**
 * lib/upload/linkedin.js — LinkedIn UGC Video Uploader
 *
 * Posts video content to LinkedIn via the LinkedIn Marketing API v2
 * using the UGC Posts endpoint (supports both personal and Company Pages).
 *
 * Requirements (set in .env):
 *   LINKEDIN_ACCESS_TOKEN  — OAuth 2.0 access token with w_member_social scope
 *   LINKEDIN_PERSON_URN    — urn:li:person:{id}  (for personal posts)
 *   LINKEDIN_COMPANY_URN   — urn:li:company:{id} (for Company Page posts)
 *   LINKEDIN_CLIENT_ID     — LinkedIn app client ID (for OAuth URL builder)
 *   LINKEDIN_CLIENT_SECRET — LinkedIn app client secret
 *
 * Setup:
 *   1. Create app at developer.linkedin.com (type: "Marketing")
 *   2. Add "Sign In with LinkedIn" product for OAuth
 *   3. Request w_member_social permission (requires approval for production)
 *   4. Get access token via OAuth 2.0 flow
 *   5. Find your Person URN: GET https://api.linkedin.com/v2/me (Bearer token)
 *
 * API docs:
 *   - Register upload: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/organizations/image-video-upload
 *   - UGC Posts:       https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
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

const LI_API  = 'https://api.linkedin.com/v2';
const LI_AUTH = 'https://www.linkedin.com/oauth/v2';

/**
 * Build LinkedIn OAuth 2.0 authorization URL.
 *
 * @param {string} redirectUri — Must match app registered redirect URI
 * @param {string} [state]    — CSRF state token
 */
export function getLinkedInAuthUrl(redirectUri, state = 'tkp-linkedin') {
  const clientId = env.LINKEDIN_CLIENT_ID;
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not set in .env');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'w_member_social openid profile email',
    state,
  });
  return `${LI_AUTH}/authorization?${params}`;
}

/**
 * Exchange auth code for access token.
 *
 * @param {string} code         — Auth code from OAuth redirect
 * @param {string} redirectUri  — Must match the URI used in getLinkedInAuthUrl
 */
export async function exchangeLinkedInCode(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id:    env.LINKEDIN_CLIENT_ID,
    client_secret: env.LINKEDIN_CLIENT_SECRET,
  });
  const res = await fetch(`${LI_AUTH}/accessToken?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status} — ${await res.text()}`);
  return res.json(); // { access_token, expires_in, scope, ... }
}

export class LinkedInUploader {
  /**
   * @param {object} opts
   * @param {string} [opts.accessToken] — LINKEDIN_ACCESS_TOKEN from .env
   * @param {string} [opts.personUrn]   — urn:li:person:{id} for personal posts
   * @param {string} [opts.companyUrn]  — urn:li:company:{id} for Company Page posts
   */
  constructor({ accessToken = env.LINKEDIN_ACCESS_TOKEN, personUrn = env.LINKEDIN_PERSON_URN, companyUrn = env.LINKEDIN_COMPANY_URN } = {}) {
    this.accessToken = accessToken;
    this.personUrn  = personUrn;
    this.companyUrn = companyUrn;
    this._enabled   = !!(accessToken && personUrn);
  }

  get enabled() { return this._enabled; }

  _headers(extra = {}) {
    return {
      'Authorization':    `Bearer ${this.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type':     'application/json',
      ...extra,
    };
  }

  /**
   * Validate credentials by calling the /me endpoint.
   */
  async healthCheck() {
    if (!this._enabled) {
      return { ok: false, error: 'Missing LINKEDIN_ACCESS_TOKEN or LINKEDIN_PERSON_URN' };
    }
    try {
      const res = await fetch(`${LI_API}/me`, { headers: this._headers() });
      if (!res.ok) return { ok: false, error: `Token invalid: ${res.status}` };
      const data = await res.json();
      return { ok: true, urn: data.id, name: data.localizedFirstName + ' ' + data.localizedLastName };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Upload and publish a video to LinkedIn.
   *
   * @param {object}   opts
   * @param {string}   opts.videoPath       — Local path to MP4 video
   * @param {string}   [opts.title]         — Video title
   * @param {string}   [opts.comment]       — Initial comment / caption text
   * @param {string}   [opts.authorUrn]     — Override author URN (default: personUrn)
   * @param {string}   [opts.visibility]     — 'PUBLIC' | 'CONNECTIONS' (default: PUBLIC)
   * @param {string}   [opts.thumbnailPath] — Local path to JPEG thumbnail
   * @param {Function} [opts.onProgress]    — { phase, progress, message }
   *
   * LinkedIn video requirements:
   *   - Format: MP4 (H.264), MOV, AVI, or MKV
   *   - Max file size: 5 GB
   *   - Aspect ratio: 1:2.4 to 2.4:1
   *   - Min duration: 3 seconds
   */
  async upload({ videoPath, title = '', comment = '', authorUrn, visibility = 'PUBLIC', thumbnailPath, onProgress }) {
    const log = onProgress ?? (() => {});

    if (!this._enabled) {
      throw new Error(
        'LinkedIn not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in .env. ' +
        'See lib/upload/linkedin.js header for setup instructions.'
      );
    }

    if (!existsSync(videoPath)) {
      return { success: false, error: `Video file not found: ${videoPath}` };
    }

    const author = authorUrn || this.personUrn;
    const videoBuffer = readFileSync(videoPath);
    const totalBytes = videoBuffer.length;

    try {
      // Step 1: Register upload — get signed upload URL
      log({ phase: 'register', progress: 0.1, message: 'Registering video upload...' });
      const registerRes = await fetch(`${LI_API}/assets`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          registerUploadRequest: {
            owner: author,
            serviceRelationships: [
              { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
            ],
            ...(this.companyUrn && author.includes('company')
              ? { associateToEntity: author, entity: 'COMPANY_UPDATE' }
              : {}),
          },
        }),
      });

      if (!registerRes.ok) {
        const err = await registerRes.json();
        throw new Error(`Asset registration failed: ${JSON.stringify(err)}`);
      }

      const { value: { asset: assetUrn, uploadMechanism } } = await registerRes.json();
      const uploadUrl =
        uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
        ?? uploadMechanism?.uploadUrl;

      if (!uploadUrl) {
        throw new Error(`No upload URL in response: ${JSON.stringify(uploadMechanism)}`);
      }

      log({ phase: 'register', progress: 0.2, message: `Asset URN: ${assetUrn}` });

      // Step 2: PUT video bytes to signed upload URL
      log({ phase: 'upload', progress: 0.3, message: 'Uploading video bytes...' });
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'video/mp4',
        },
        body: videoBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error(`Video PUT failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      log({ phase: 'upload', progress: 0.7, message: 'Upload complete.' });

      // Step 3: Create UGC Post
      log({ phase: 'publish', progress: 0.85, message: 'Publishing UGC post...' });
      const shareContent = {
        shareMediaCategory: 'VIDEO',
        media: [
          {
            status:     'READY',
            originalUrl: assetUrn,
            ...(title ? { title: { text: title.slice(0, 200) } } : {}),
            ...(comment ? { description: { text: comment.slice(0, 3000) } } : {}),
          },
        ],
      };

      const visibilityMap = {
        PUBLIC:      'PUBLIC',
        CONNECTIONS: 'CONNECTIONS',
      };

      const ugcRes = await fetch(`${LI_API}/ugcPosts`, {
        method:  'POST',
        headers: this._headers(),
        body: JSON.stringify({
          author,
          lifecycleState:     'PUBLISHED',
          specificContent:    { 'com.linkedin.ugc.ShareContent': shareContent },
          visibility:         { 'com.linkedin.ugc.MemberNetworkVisibility': visibilityMap[visibility] ?? 'PUBLIC' },
        }),
      });

      if (!ugcRes.ok) {
        const err = await ugcRes.json();
        throw new Error(`UGC post creation failed: ${JSON.stringify(err)}`);
      }

      const ugcData = await ugcRes.json();
      const postUrn  = ugcData.id ?? ugcData;
      const postId   = typeof postUrn === 'string' ? postUrn : String(postUrn);
      const permalink = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`;

      log({ phase: 'done', progress: 1.0, message: `Posted: ${permalink}` });

      return {
        success: true,
        postId: postId,
        assetUrn,
        permalink,
        platform: 'linkedin',
      };
    } catch (err) {
      return { success: false, error: err.message, platform: 'linkedin' };
    }
  }
}
