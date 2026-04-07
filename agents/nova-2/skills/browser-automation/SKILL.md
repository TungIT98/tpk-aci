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
- `browser(action="open", profile="user")`
- `browser(action="navigate", url="...")`
- `browser(action="snapshot")`
- `browser(action="act", kind="click", ref="...")`
- `browser(action="act", kind="type", text="...", ref="...")`
- `browser(action="act", kind="press", key="...")`
- `browser(action="act", kind="wait", ms=N)`

## CRITICAL Rules

1. **ALWAYS click textarea/input before typing**
2. **ALWAYS clear with Ctrl+A, Backspace** before entering new prompt
3. **ALWAYS use slowly=true** for prompts longer than 50 characters
4. **Use string selectors** — e.g., `[contenteditable]`, `[button:Create]`
5. **Wait 5-15 minutes for Hailuo** video generation

## Selector Reference

| Element | Selector |
|---------|----------|
| Hailuo prompt box | `[contenteditable]` |
| Create button | `[button:Create]` |
| Model selector | `[model-selector]` |
| Download button | `[button:Download]` |

## What NOT To Use
- ❌ Playwright scripts
- ❌ Node.js automation (puppeteer, selenium)
- ❌ exec() for browser control
