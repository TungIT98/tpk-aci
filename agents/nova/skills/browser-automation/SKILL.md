---
name: browser-automation
description: >
  Use when: Controlling a browser for AI video generation, navigating to websites,
  filling forms, or clicking buttons programmatically.
  Do NOT use when: Writing code, managing files, or analyzing data.
---

# Browser Automation Skill (OpenClaw Only)

## OpenClaw Tool Reference

### Available Actions
- `browser(action="open", profile="user")` — Open browser with user profile
- `browser(action="navigate", url="...")` — Navigate to URL
- `browser(action="snapshot")` — Take screenshot/page state
- `browser(action="act", kind="click", ref="...")` — Click element
- `browser(action="act", kind="type", text="...", ref="...")` — Type text
- `browser(action="act", kind="press", key="...")` — Press keyboard key
- `browser(action="act", kind="wait", ms=N)` — Wait milliseconds

## CRITICAL Rules

1. **ALWAYS click textarea/input before typing** — Hailuo requires focus
2. **ALWAYS clear with Ctrl+A, Backspace** — Before entering new prompt
3. **ALWAYS use slowly=true** — For prompts longer than 50 characters
4. **Use string selectors, not ref IDs** — e.g., `[contenteditable]`, `[button:Create]`
5. **Wait 5-15 minutes for Hailuo** — Video generation is slow

## Selector Reference

| Element | Selector |
|---------|----------|
| Hailuo prompt box | `[contenteditable]` |
| Create button | `[button:Create]` |
| Model selector | `[model-selector]` |
| Duration selector | `[duration-selector]` |
| Download button | `[button:Download]` |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Page won't load | Wait 10s, retry navigate |
| Button not found | Take snapshot, check page state |
| Typing fails | Click textarea first |
| Video stuck generating | Wait another 5 min, check again |
| Browser crash | Re-open with `browser(action="open", profile="user")` |

## What NOT To Use
- ❌ Playwright scripts
- ❌ Node.js automation (puppeteer, selenium)
- ❌ exec() or shell commands for browser control
- ❌ Manual browser control
