# TikTok Browser Upload Fix — 2026-04-03

## Issue (TKP-2098)
PM agent had 23 xianxia upload tasks stuck in `todo`. PM heartbeat was running (touching tasks), but none were marked `done` and scripts had no `tiktok_uploaded_at` timestamps.

## Root Cause
`lib/upload/tiktok-browser.js` had a **false-negative success detection bug**:
- After clicking POST, TikTok does NOT redirect to a content page — it stays on the upload page
- Old code returned `{ success: false }` whenever URL contained `/upload`
- PM would run upload → script returned false → PM reverted task → task appeared stuck

## Fix Applied
Updated success detection in `tiktok-browser.js` to use **multi-indicator approach**:

1. **Toast/success message detection** — looks for text: "đăng thành công", "posted successfully", "your video has been posted", etc.
2. **View Post link** — checks for `a[href*="/video/"]` or `[class*="view-post"]`
3. **Form cleared** — if the file input is empty after post, upload succeeded
4. **URL navigation** — only as a secondary hint (not primary)

Also improved error classification: hard errors (upload failed, file too long/short) return false immediately; soft warnings may still mean success.

## Key Code Location
`lib/upload/tiktok-browser.js` lines 660–720 (success detection block)

## Status
TKP-2098 marked done. PM pipeline should now correctly detect successful uploads.
