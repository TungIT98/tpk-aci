/**
 * lib/upload/youtube.js — YouTube Data API v3 uploader
 *
 * Full-featured YouTube upload with resumable uploads, progress tracking,
 * thumbnail support, metadata (title, description, tags, category, privacy),
 * and processing-status polling.
 *
 * Requirements (set in .env):
 *   YOUTUBE_CLIENT_ID     — OAuth 2.0 Client ID
 *   YOUTUBE_CLIENT_SECRET — OAuth 2.0 Client Secret
 *   YOUTUBE_REFRESH_TOKEN — Long-lived refresh token (from OAuth flow)
 *
 * Setup:
 *   1. Create project at console.cloud.google.com
 *   2. Enable YouTube Data API v3
 *   3. Create OAuth 2.0 Client ID (type: Desktop app or Web application)
 *   4. Run: node -e "const u=require('./lib/upload/youtube.js'); console.log(u.YouTubeUploader.getAuthUrl('http://localhost'))"
 *      → visit URL → authorize → copy ?code= from redirect → node scripts/oauth-youtube.js <code>
 *   5. Save refresh_token to .env
 *
 * API docs:
 *   - Resumable upload: https://developers.google.com/youtube/v3/guides/uploading_a_video
 *   - Videos.insert:    https://developers.google.com/youtube/v3/docs/videos/insert
 *   - Thumbnails.set:   https://developers.google.com/youtube/v3/docs/thumbnails/set
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Registry } from "../registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const e = {};
    for (const l of readFileSync(resolve(__dirname, "..", "..", ".env"), "utf-8").split("\n")) {
      const t = l.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      e[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return e;
  } catch { return process.env; }
}

const env = loadEnv();

const YT_TOKEN_URL  = "https://oauth2.googleapis.com/token";
const YT_API        = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";

// YouTube category IDs: https://developers.google.com/youtube/v3/docs/videoCategories
export const YOUTUBE_CATEGORIES = {
  "Film & Animation":       "1",
  "Autos & Vehicles":       "2",
  "Music":                  "10",
  "Pets & Animals":        "15",
  "Sports":                 "17",
  "Gaming":                 "20",
  "Blogs":                  "22",
  "Comedy":                 "23",
  "Entertainment":          "24",
  "News & Politics":        "25",
  "Howto & Style":          "26",
  "Education":              "27",
  "Science & Technology":   "29",
};

export class YouTubeUploader {
  /**
   * @param {object} opts
   * @param {string} [opts.clientId]     — YOUTUBE_CLIENT_ID
   * @param {string} [opts.clientSecret] — YOUTUBE_CLIENT_SECRET
   * @param {string} [opts.refreshToken] — YOUTUBE_REFRESH_TOKEN
   */
  constructor({
    clientId     = env.YOUTUBE_CLIENT_ID,
    clientSecret = env.YOUTUBE_CLIENT_SECRET,
    refreshToken = env.YOUTUBE_REFRESH_TOKEN,
  } = {}) {
    this.clientId     = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this._token       = null;
    this._tokenExpiry = 0;
  }

  get enabled() {
    return !!(this.clientId && this.clientSecret && this.refreshToken);
  }

  // ── Token management ──────────────────────────────────────────────────────────

  async _tk() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiry) return this._token;

    const r = await fetch(YT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: this.refreshToken,
        client_id:     this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!r.ok) throw new Error(`YT token refresh failed: ${r.status} — ${await r.text()}`);
    const json = await r.json();
    this._token      = json.access_token;
    this._tokenExpiry = now + (json.expires_in ?? 3600) * 1000 - 60_000; // 1-min buffer
    return this._token;
  }

  // ── Health check ─────────────────────────────────────────────────────────────

  /**
   * Validate credentials by fetching the authenticated channel.
   * @returns {Promise<{ok: boolean, channelId?: string, title?: string, error?: string}>}
   */
  async healthCheck() {
    if (!this.enabled) return { ok: false, error: "Missing YouTube credentials in .env" };
    try {
      const t = await this._tk();
      const r = await fetch(`${YT_API}/channels?part=snippet&mine=true`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!r.ok) return { ok: false, error: `YouTube API error: ${r.status}` };
      const data = await r.json();
      const ch   = data.items?.[0];
      if (!ch)   return { ok: false, error: "No YouTube channel found" };
      return { ok: true, channelId: ch.id, title: ch.snippet.title };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  /**
   * Upload a video to YouTube with full metadata and progress tracking.
   *
   * @param {object}   opts
   * @param {string}   opts.videoPath       — Local path to MP4 video
   * @param {string}   opts.title          — Video title (max 100 chars)
   * @param {string}   [opts.description]  — Video description (max 5000 chars)
   * @param {string[]} [opts.tags]         — Array of string tags (max 500 chars total)
   * @param {string}   [opts.categoryId]  — YouTube category ID (default "22")
   * @param {string}   [opts.privacyStatus] — "public" | "unlisted" | "private" (default "private")
   * @param {string}   [opts.thumbnailPath] — Local JPEG/PNG thumbnail path
   * @param {Function} [opts.onProgress]   — Called with { phase, progress 0-1, message }
   * @param {string}   [opts.registryId]   — Video ID to record in production registry (e.g. "PW-01")
   *
   * @returns {Promise<{success: boolean, videoId?: string, permalink?: string, error?: string}>}
   */
  async upload({
    videoPath,
    title,
    description  = "",
    tags         = [],
    categoryId   = "22",
    privacyStatus = "private",
    thumbnailPath,
    onProgress,
    registryId,
  }) {
    const log = onProgress ?? (() => {});

    if (!this.enabled) {
      throw new Error(
        "YouTube not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, " +
        "and YOUTUBE_REFRESH_TOKEN in .env. See lib/upload/youtube.js header."
      );
    }
    if (!existsSync(videoPath)) {
      return { success: false, error: `Video file not found: ${videoPath}` };
    }

    const token = await this._tk();
    const buf   = readFileSync(videoPath);
    const size  = buf.length;

    // Chunk size for resumable upload (10 MB)
    const CHUNK = 10 * 1024 * 1024;

    try {
      // ── Phase 1: Initiate resumable upload session ────────────────────────────
      log({ phase: "init", progress: 0.05, message: "Initiating YouTube upload session..." });

      const metadata = {
        snippet: {
          title:       (title || "Untitled").slice(0, 100),
          description: description.slice(0, 5000),
          tags:        (tags || []).join(" ").slice(0, 499).split(" ").filter(Boolean),
          categoryId:  String(categoryId || "22"),
        },
        status: {
          privacyStatus:            privacyStatus || "private",
          selfDeclaredMadeForKids:  false,
        },
      };

      const initRes = await fetch(
        `${YT_UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`,
        {
          method: "POST",
          headers: {
            "Authorization":             `Bearer ${token}`,
            "Content-Type":             "application/json",
            "X-Upload-Content-Length":  String(size),
            "X-Upload-Content-Type":    "video/mp4",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        const txt = await initRes.text();
        throw new Error(`YouTube init failed: ${initRes.status} — ${txt}`);
      }

      const uploadUrl = initRes.headers.get("Location") || initRes.headers.get("location");
      if (!uploadUrl) throw new Error("No resumable upload URL in Location header");

      log({
        phase:    "init",
        progress: 0.10,
        message:  `Session open — video size: ${(size / 1024 / 1024).toFixed(1)} MB`,
      });

      // ── Phase 2: Upload video bytes (chunked resumable) ─────────────────────
      let offset   = 0;
      let videoId  = null;

      while (offset < size) {
        const chunk = buf.slice(offset, Math.min(offset + CHUNK, size));
        const end   = offset + chunk.length - 1;

        const chunkRes = await fetch(uploadUrl, {
          method:  "PUT",
          headers: {
            "Authorization":         `Bearer ${token}`,
            "Content-Length":       String(chunk.length),
            "Content-Range":        `bytes ${offset}-${end}/${size}`,
            "X-Upload-Content-Type": "video/mp4",
          },
          body: chunk,
        });

        if (chunkRes.status === 200 || chunkRes.status === 201) {
          // Upload complete — response body is JSON with video resource
          const body = await chunkRes.json().catch(() => ({}));
          videoId = body.id ?? null;
          offset  = size; // break loop
          break;
        }

        if (chunkRes.status !== 308) {
          const txt = await chunkRes.text();
          throw new Error(`Chunk upload failed: ${chunkRes.status} — ${txt}`);
        }

        // 308: read Range header to advance offset
        const rangeHdr = chunkRes.headers.get("Range");
        if (rangeHdr) {
          const m = rangeHdr.match(/bytes=(\d+)-(\d+)/);
          if (m) offset = parseInt(m[2], 10) + 1;
          else    offset += chunk.length;
        } else {
          offset += chunk.length;
        }

        const pct = Math.min(0.65, 0.10 + (offset / size) * 0.55);
        log({
          phase:    "upload",
          progress: pct,
          message:  `${Math.round(pct * 100)}% — ${(offset / 1024 / 1024).toFixed(1)} / ${(size / 1024 / 1024).toFixed(1)} MB`,
        });
      }

      log({ phase: "upload", progress: 0.70, message: "Video bytes uploaded." });

      // ── Phase 3: Poll processing status ─────────────────────────────────────
      if (videoId) {
        await this._pollProcessing(token, videoId, log);
      } else {
        // Fallback: try to extract from upload URL
        const m = uploadUrl.match(/\/videos\/([a-zA-Z0-9_-]{11})/);
        if (m) {
          videoId = m[1];
          await this._pollProcessing(token, videoId, log);
        } else {
          log({ phase: "processing", progress: 0.75, message: "Could not determine video ID — check YouTube Studio" });
        }
      }

      // ── Phase 4: Upload thumbnail (optional) ─────────────────────────────────
      let thumbnailSet = false;
      if (thumbnailPath && existsSync(thumbnailPath) && videoId) {
        thumbnailSet = await this._uploadThumbnail(token, videoId, thumbnailPath, log);
      }

      const permalink = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

      log({
        phase:    "done",
        progress: 1.0,
        message:  videoId ? `Published: ${permalink}` : "Upload complete — check YouTube Studio",
      });

      // Record successful upload in production registry
      if (registryId && videoId) {
        try {
          const reg = new Registry();
          reg.recordUpload({ id: registryId, platform: 'youtube', url: permalink, videoId });
        } catch (err) {
          console.warn(`[YouTubeUploader] registry record failed: ${err.message}`);
        }
      }

      return { success: true, videoId, permalink, thumbnailSet, platform: "youtube" };
    } catch (err) {
      return { success: false, error: err.message, platform: "youtube" };
    }
  }

  // ── Processing-status polling ─────────────────────────────────────────────────

  /**
   * Poll until the video is "processed" or a terminal state is reached.
   * @param {string} token
   * @param {string} videoId
   * @param {Function} log — onProgress callback
   */
  async _pollProcessing(token, videoId, log) {
    const maxWaitMs      = 15 * 60 * 1000; // 15 min
    const pollIntervalMs = 15_000;
    const deadline        = Date.now() + maxWaitMs;
    const BASE_PCT        = 0.72;

    while (Date.now() < deadline) {
      const r    = await fetch(`${YT_API}/videos?part=status&id=${videoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      const item = data.items?.[0];
      const state = item?.status?.uploadStatus;
      const proc  = item?.status?.processingStatus;

      if (state === "processed" || proc === "complete") {
        log({ phase: "processing", progress: 0.90, message: "Video processed and live!" });
        return;
      }
      if (state === "failed") {
        throw new Error(`YouTube upload failed: ${item.status.failureReason || "unknown"}`);
      }
      if (state === "rejected") {
        throw new Error(`YouTube rejected video: ${item.status.rejectionReason || "unknown"}`);
      }

      log({
        phase:    "processing",
        progress: BASE_PCT,
        message:  `Status: ${state || "processing"} — waiting for processing to complete...`,
      });
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    // Don't throw on timeout — video may still process; just warn
    log({ phase: "processing", progress: 0.88, message: "Processing timeout — check YouTube Studio" });
  }

  // ── Thumbnail upload ──────────────────────────────────────────────────────────

  /**
   * Upload a JPEG/PNG thumbnail for a video.
   * @returns {Promise<boolean>} true on success
   */
  async _uploadThumbnail(token, videoId, thumbnailPath, log) {
    log({ phase: "thumbnail", progress: 0.92, message: "Uploading thumbnail..." });
    try {
      const buf = readFileSync(thumbnailPath);
      const r   = await fetch(`${YT_API}/thumbnails/set?videoId=${videoId}`, {
        method:  "POST",
        headers: {
          "Authorization":  `Bearer ${token}`,
          "Content-Type":   "image/jpeg",
          "Content-Length": String(buf.length),
        },
        body: buf,
      });
      if (!r.ok) {
        console.warn(`[YouTubeUploader] thumbnail failed: ${r.status}`);
        return false;
      }
      log({ phase: "thumbnail", progress: 0.95, message: "Thumbnail set." });
      return true;
    } catch (err) {
      console.warn(`[YouTubeUploader] thumbnail error: ${err.message}`);
      return false;
    }
  }

  // ── OAuth helpers (for use in scripts) ───────────────────────────────────────

  /**
   * Build the Google OAuth consent URL.
   * @param {string} redirectUri — Must match registered redirect URI
   */
  static getAuthUrl(redirectUri) {
    const cid = env.YOUTUBE_CLIENT_ID;
    if (!cid) throw new Error("YOUTUBE_CLIENT_ID not set");
    const params = new URLSearchParams({
      client_id:     cid,
      redirect_uri:  redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube",
      ].join(" "),
      access_type: "offline",
      prompt:      "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange auth code for access + refresh tokens.
   * @param {string} code        — Auth code from OAuth redirect
   * @param {string} redirectUri — Must match URI used in getAuthUrl
   * @returns {Promise<{access_token, refresh_token, expires_in}>}
   */
  static async exchangeCode(code, redirectUri) {
    const r = await fetch(YT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        client_id:     env.YOUTUBE_CLIENT_ID,
        client_secret: env.YOUTUBE_CLIENT_SECRET,
      }),
    });
    if (!r.ok) throw new Error(`YouTube OAuth exchange failed: ${r.status} — ${await r.text()}`);
    return r.json();
  }
}
