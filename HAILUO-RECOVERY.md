# Hailuo Session Recovery - TKP-135

## Problem
Hailuo session cookies expired (last valid: 2026-03-27).
- `isLoggedIn()` returns TRUE (DOM check) but API auth is BROKEN
- Submitting a prompt shows "Continue with Google" login modal
- Videos cannot be generated

## Fixed Scripts

### 1. Verify Session Status
```bash
cd C:/Users/PC/.paperclip/instances/default/workspaces/TKP_ACI
node scripts/hailuo-auto-login-v2.js
```
This uses `testAuth()` which actually submits a prompt and checks for login modal.

### 2. Re-authenticate (Manual Required)
```bash
node scripts/hailuo-session-fix.js
```
- Opens a visible browser window (headful mode)
- Navigates to hailuoai.video
- If redirected to login → log in manually with thanhtungtran364@gmail.com
- Waits for you to press ENTER
- Saves session to `.hailuo-session.json`
- **NOTE**: Requires a display. If running on a server without display, skip to option 3.

### 3. Alternative: Re-run auto-login (quick fix if session partially works)
```bash
node scripts/hailuo-auto-login.js
```

### 4. Generate 6 Videos (After Valid Session)
```bash
# Verify session first
node scripts/hailuo-auto-login-v2.js

# Then generate
node scripts/regen-tkp135-v5.js
```
This uses the fixed approach:
- Detects blob URL via page.evaluate()
- Extracts video from browser context (blob URLs can't be fetched by Node.js)
- Verifies hash to confirm uniqueness

### 5. Verify Video Uniqueness
```bash
node scripts/check-video-hashes.js
```

## Videos Needed
| Script | Title | Topic |
|--------|-------|-------|
| AESTH-01 | ... | Aesthetic |
| COM-01 | ... | Comedy |
| LIFE-01 | ... | Lifestyle |
| MOT-01 | ... | Motivation |
| MOVIE-01 | ... | Movie Review |
| TECH-01 | ... | Tech & AI |

All scripts are in `scripts/pending/` (already written).

## Root Cause Analysis
1. `isLoggedIn()` in hailuo-app.js checks DOM for avatar images
   - These were cached from previous session
   - Returns TRUE even when API cookies are expired
   - **FIXED**: Added `testAuth()` method that submits a real prompt

2. Completion detection found cached videos instead of new ones
   - Original: checked video elements immediately after submit
   - Fix v5: waits for blob URL to appear, extracts from browser context

## If All Else Fails
- Check Hailuo account status: https://hailuoai.video
- Verify thanhtungtran364@gmail.com has credits
- Check if Hailuo has updated their anti-bot measures
