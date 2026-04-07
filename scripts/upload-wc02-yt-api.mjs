#!/usr/bin/env node
/**
 * Upload WC-02 to YouTube via YouTube Data API v3 using refresh token
 */
import { createReadStream, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VIDEO_PATH = 'C:\\Users\\PC\\.paperclip\\instances\\default\\workspaces\\TKP_ACI\\output\\WC-02-fresh.mp4';
const TITLE = 'The Entire Bar Falls Silent';
const DESCRIPTION = `⚽ The Entire Bar Falls Silent

The ball gets passed. Then again. Then suddenly everyone's on their feet. Nobody breathes. The keeper stretches. The striker shoots. The net ripples. And then — absolute mayhem.

Beers spill. Strangers grab each other. Someone screams so loud the windows shake.

The bar has become a church and we are all preaching the same sermon: WE SCORED! ⚽

#worldcup #football #sportsbar #celebration #goals #soccer #fyp #viral`;

// Read credentials from .env
const envContent = readFileSync(join(ROOT, '.env'), 'utf8');
const refreshToken = (envContent.match(/YOUTUBE_REFRESH_TOKEN=(.+)/) || [])[1]?.trim();
const clientId = (envContent.match(/GOOGLE_CLIENT_ID=(.+)/) || [])[1]?.trim();
const clientSecret = (envContent.match(/GOOGLE_CLIENT_SECRET=(.+)/) || [])[1]?.trim();

console.log('[YouTube API] Refresh token available:', !!refreshToken);
console.log('[YouTube API] Client ID available:', !!clientId);
console.log('[YouTube API] Video exists:', existsSync(VIDEO_PATH));

async function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = (options.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function getAccessToken() {
  console.log('[YouTube API] Getting access token...');
  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  const res = await request({
    method: 'POST',
    protocol: 'https:',
    host: 'oauth2.googleapis.com',
    path: '/token',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  });

  const data = JSON.parse(res.data);
  if (res.status !== 200) {
    throw new Error(`Token error: ${res.status} - ${JSON.stringify(data)}`);
  }
  console.log('[YouTube API] Access token obtained');
  return data.access_token;
}

async function uploadVideo(accessToken, videoPath) {
  console.log('[YouTube API] Starting resumable upload...');
  
  // Step 1: Initiate resumable upload
  const metadata = {
    snippet: {
      title: TITLE,
      description: DESCRIPTION,
      tags: ['worldcup', 'football', 'sportsbar', 'celebration', 'goals', 'soccer'],
      categoryId: '17' // Sports
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };

  const initRes = await request({
    method: 'POST',
    protocol: 'https:',
    host: 'www.googleapis.com',
    path: '/upload/youtube/v3/videos?uploadType=resumable',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(require('fs').statSync(videoPath).size)
    }
  }, JSON.stringify(metadata));

  console.log('[YouTube API] Init response status:', initRes.status);
  
  if (initRes.status !== 200) {
    console.log('[YouTube API] Init failed:', initRes.data);
    throw new Error(`Init failed: ${initRes.status}`);
  }

  const uploadUrl = initRes.headers?.location || (JSON.parse(initRes.data.match(/\{.*\}/) || ['{}'])[0]);
  console.log('[YouTube API] Upload URL from header:', initRes.headers?.location ? 'found' : 'not found');
  
  // The location header should contain the upload URL
  // For now, try parsing from data if header not found
  let sessionUri;
  const locationMatch = initRes.data.match(/"location"\s*:\s*"([^"]+)"/);
  if (locationMatch) sessionUri = locationMatch[1];
  
  if (!sessionUri && initRes.headers?.location) {
    // The location might be in the response headers
    console.log('[YouTube API] Headers:', JSON.stringify(initRes.headers));
  }
  
  console.log('[YouTube API] Init response:', initRes.data.substring(0, 500));
}

async function main() {
  try {
    const accessToken = await getAccessToken();
    await uploadVideo(accessToken, VIDEO_PATH);
  } catch(e) {
    console.error('[YouTube API] Error:', e.message);
    process.exit(1);
  }
}

main();
