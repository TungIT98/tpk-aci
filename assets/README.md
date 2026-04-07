# TKP Channel Art Assets — Export Guide

> Production-ready SVG channel art assets for TKP Productivity and TKP Growth.
> All SVGs use Google Fonts via `@import` and are viewable in any modern browser.

---

## Assets

| File | Channel | Dimensions | Use |
|------|---------|-----------|-----|
| `tkp-productivity-pfp.svg` | TKP Productivity | 800×800 | YouTube profile picture |
| `tkp-growth-pfp.svg` | TKP Growth | 800×800 | YouTube profile picture |
| `tkp-productivity-banner.svg` | TKP Productivity | 2560×1440 | Channel banner |
| `tkp-growth-banner.svg` | TKP Growth | 2560×1440 | Channel banner |
| `tkp-watermark-prod.svg` | TKP Productivity | 160×60 | Video watermark |
| `tkp-watermark-growth.svg` | TKP Growth | 160×60 | Video watermark |

---

## Export to PNG (Required for YouTube Upload)

YouTube requires PNG (or JPG) for profile pictures and banners. Export each SVG:

### Option A — Browser (fastest)
1. Open each `.svg` file in Chrome/Firefox
2. Right-click → **Save image as...** → choose PNG

### Option B — Figma / Canva
1. Import the SVG into your design tool
2. Export as PNG at the specified dimensions

### Option C — Command line (ImageMagick)
```bash
# Install ImageMagick if needed, then:
magick convert tkp-productivity-pfp.svg tkp-productivity-pfp.png
magick convert tkp-growth-pfp.svg tkp-growth-pfp.png
magick convert tkp-productivity-banner.svg tkp-productivity-banner.png
magick convert tkp-growth-banner.svg tkp-growth-banner.png
```

### Option D — Node.js with Sharp
```bash
npm install sharp
node -e "
const sharp = require('sharp');
const files = ['tkp-productivity-pfp','tkp-growth-pfp','tkp-productivity-banner','tkp-growth-banner','tkp-watermark-prod','tkp-watermark-growth'];
files.forEach(f => sharp('assets/'+f+'.svg').png().toFile('assets/'+f+'.png'));
"
```

---

## YouTube Upload Steps

### Profile Picture (both channels)
1. YouTube Studio → **Customization** → **Basic info**
2. Upload `tkp-productivity-pfp.png` to TKP Productivity
3. Upload `tkp-growth-pfp.png` to TKP Growth
4. YouTube auto-crops to circle — ensure TKP wordmark is centered

### Channel Banner (both channels)
1. YouTube Studio → **Customization** → **Banner**
2. Upload at 2560×1440 — YouTube auto-crops for different devices
3. **Safe zone**: text/logos within center 1546×423 px — elements outside may be cropped on mobile/TV

### Video Watermark (both channels)
1. YouTube Studio → **Customization** → **Branding**
2. Upload `tkp-watermark-prod.png` / `tkp-watermark-growth.png`
3. Set display: **During last 30 seconds of video**
4. Size: use YouTube's default

---

## Design Notes

- **Fonts**: DM Sans (Productivity) and Bebas Neue (Growth) loaded via Google Fonts. Ensure internet connection on first render, or embed fonts as paths if working offline.
- **PFP circles**: YouTube displays profile pictures as circles. The TKP wordmark is centered — no important elements at extreme edges.
- **Banner safe zone**: All critical content (wordmarks, taglines, pillars) is in the center 1546px-wide zone. Decorative elements extend to edges.
- **Colors**: All hex values match `content/brand-identity.md` specs exactly.
