# IMPORTANT - Browser Session Fix (2026-03-29)

## Issue
Hailuo browser automation is failing because it opens a NEW browser instead of using the SAVED session.

## Symptoms
- Browser opens with "trình duyệt không an toàn" error
- User is already logged in Chrome but session is not reused
- Playwright creates fresh browser context

## Solution

### Option 1: Fix HailuoApp to use saved session
When initializing HailuoApp, make sure it loads the saved session:

```javascript
const app = new HailuoApp({
  sessionPath: '.hailuo-session.json',  // Must exist
  headless: false,  // Set to false to debug
});
```

### Option 2: Re-setup Hailuo session
1. Delete `.hailuo-session.json`
2. Run: `node scripts/setup-hailuo-app-session.js`
3. Login manually in the browser window
4. Press ENTER to save session
5. Then retry video generation

### Option 3: Use OpenClaw Browser instead
OpenClaw browser (profile=`user`) already has Hailuo logged in.
Consider using OpenClaw browser tool instead of Playwright.

## Files to check
- `.hailuo-session.json` - saved browser session
- `lib/hailuo-app.js` - HailuoApp class
- `scripts/setup-hailuo-app-session.js` - session setup script
