# Stock Footage Library — TKP Content Agency

> Implementation for TKP-27 (VID-16). Sourcing strategy, folder structure, licensing
> compliance, tagging system, and curated clip catalog for both channels.
>
> Pexels API key: configured in `.env` (`PEXELS_API_KEY`)
> Pixabay API key: placeholder in `.env` — activate at `pixabay.com/api`

---

## 1. Sourcing Strategy

### Primary Sources

| Source | Plan | Monthly Limit | Best For |
|--------|------|--------------|---------|
| **Pexels** | Free (200 credits/mo) | 200 video downloads | Primary source — highest quality, best licensing |
| **Pixabay** | Free (200 credits/mo) | 200 video downloads | Supplement Pexels; different catalog coverage |
| **Coverr** | Free, no limit | Unlimited | Quick ambient clips, B-roll filler |
| **Mixkit** | Free, no limit | Unlimited | Modern aesthetic, tech/startup vibes |
| **Videvo** | Free tier | 10 downloads/week | Motion graphics, lower thirds |

### Budget Backup (if monthly limits exhausted)

| Source | Cost | Notes |
|--------|------|-------|
| Adobe Stock | ~$30/mo | Only if Pexels + Pixabay exhausted |
| Shutterstock Video | ~$150/mo | Last resort; not recommended for pre-revenue stage |

### Sourcing Priority Rules

1. Always search **Pexels first** — licensing is simplest (free for commercial use, no attribution required)
2. Pixabay as fallback if Pexels has no match
3. Coverr/Mixkit for ambient/human B-roll without burning Pexels credits
4. Never pay for stock unless all free sources exhausted and video is critical

### Attribution Requirements

| Source | Attribution Required? | Format |
|--------|----------------------|--------|
| Pexels | Not required, but appreciated | `Videos provided by Pexels` or link |
| Pixabay | Required for some content | Check per-video license |
| Coverr | Not required | — |
| Mixkit | Not required | — |
| Videvo | Varies — check per video | Usually credits in description |

> **Note**: Pexels license covers commercial use, modification, and does not require attribution.
> We use attribution anyway as good practice and community relationship.

---

## 2. Folder Structure

```
assets/
├── stock-footage/
│   ├── channel-1-productivity/
│   │   ├── 01-workspace-sets/        ← clean desk setups, professional environments
│   │   │   ├── minimal-desk/
│   │   │   ├── standing-desk/
│   │   │   ├── coffee-shop-laptop/
│   │   │   └── notepad-pen-writing/
│   │   ├── 02-tech-screens/         ← screen recordings overlaid with B-roll
│   │   │   ├── laptop-code/
│   │   │   ├── phone-scroll/
│   │   │   ├── monitor-spreadsheet/
│   │   │   └── tablet-writing/
│   │   ├── 03-time-metaphors/       ← clocks, calendars, timers
│   │   │   ├── analog-clock-closeup/
│   │   │   ├── calendar-ticking/
│   │   │   ├── hourglass-sand/
│   │   │   └── sunset-to-night-office/
│   │   ├── 04-focus-ambient/        ← calm, productive atmosphere clips
│   │   │   ├── morning-window-light/
│   │   │   ├── rain-on-window/
│   │   │   ├── forest-trail-walk/
│   │   │   └── coffee-steam/
│   │   ├── 05-transitions/          ← wipes, zooms, glitch cuts
│   │   │   ├── zoom-fade/
│   │   │   ├── slide-left/
│   │   │   └── glitch-crossfade/
│   │   └── 06-human-moments/        ← hands, faces, authentic reactions
│   │       ├── writing-by-hand/
│   │       ├── thinking-at-window/
│   │       └── team-meeting/
│   │
│   ├── channel-2-growth/
│   │   ├── 01-city-energy/           ← urban environments, street scenes
│   │   │   ├── city-timelapse-sunset/
│   │   │   ├── busy-street-aerial/
│   │   │   ├── neon-night-city/
│   │   │   └── street-food-market/
│   │   ├── 02-money-income/         ← money, devices, hustle visuals
│   │   │   ├── phone-laptop-income/
│   │   │   ├── coffee-laptop-cafe/
│   │   │   ├── laptop-screens-graphs/
│   │   │   └── coffee-delivery-side-hustle/
│   │   ├── 03-aspirational-moments/  ← confident poses, success vibes
│   │   │   ├── person-confident-laptop/
│   │   │   ├── city-sunset-silhouette/
│   │   │   ├── creative-workspace/
│   │   │   └── hand-shake-deal/
│   │   ├── 04-fast-cuts/            ← quick zoom cuts, high-energy
│   │   │   ├── phone-scroll-fast/
│   │   │   ├── type-fast-hands/
│   │   │   └── crosswalk-jog/
│   │   ├── 05-motivation/           ← sunrise, road ahead, open horizon
│   │   │   ├── sunrise-mountain-road/
│   │   │   ├── airport-runway-takeoff/
│   │   │   ├── open-highway-aerial/
│   │   │   └── sunrise-city-view/
│   │   └── 06-transitions/          ← punchy, modern cuts
│   │       ├── swipe-up/
│   │       ├── flash-cut/
│   │       └── glitch-reveal/
│   │
│   └── shared/
│       ├── human-hands/              ← universal hands: typing, gesturing, etc.
│       ├── nature-b-roll/           ← clouds, water, leaves — cross-channel use
│       └── tech-ui/                 ← generic UI: loading screens, cursors, notifications
│
├── thumbnails/
│   ├── channel-1-productivity/
│   │   └── [organize per thumbnail-design-system.md]
│   └── channel-2-growth/
│       └── [organize per thumbnail-design-system.md]
│
├── music/
│   ├── royalty-free-licensed/        ← licensed tracks (Epidemic Sound, Artlist receipts)
│   └── shared-queue/                ← tracks downloaded and pending licensing review
│
└── scripts/
    └── video-outputs/               ← final export outputs, organized per upload-schedule.md
```

---

## 3. Licensing Compliance Checklist

### Before Downloading

- [ ] Confirm source is on approved list (Pexels, Pixabay, Coverr, Mixkit, Videvo)
- [ ] Check individual clip license — some Pixabay contributors require attribution
- [ ] Note license type: "commercial use" vs "editorial only"
- [ ] Log download in `logs/stock-footage-log.md` (see Section 6)

### After Download

- [ ] Rename file with standardized format: `{channel}-{category}-{short-description}-{date}.mp4`
  - Example: `ch1-workspace-clean-desk-sunlight-20260325.mp4`
- [ ] Move to correct subfolder immediately
- [ ] Record in stock footage log

### Prohibited Sources (Never Use)

- Any source requiring "rights clearance" beyond standard free license
- Clips featuring identifiable people without model release (check before use)
- Trademarks, logos, or copyrighted designs visible in frame
- Clips from YouTube, TikTok, or social media (even if creator claims it's free)
- Getty Images / Shutterstock clips downloaded without paid license

### Brand-Specific Restrictions

**TKP Productivity**: No branded laptops visible (Apple logo, Dell logo, etc. in frame) — use clips where logos are hidden or absent. Exception: generic laptop silhouettes.

**TKP Growth**: No corporate stock imagery of "suits shaking hands" — use authentic, urban environments instead.

---

## 4. Tagging System

### File Naming Convention

Format: `{channel}-{scene-type}-{mood}-{specific-detail}-{YYYYMMDD}.mp4`

| Segment | Values | Example |
|---------|--------|---------|
| Channel | `ch1`, `ch2` | `ch1` |
| Scene type | See folder categories above | `workspace` |
| Mood | `calm`, `energized`, `neutral`, `moody` | `calm` |
| Specific detail | 1–3 words | `morning-light` |
| Date | YYYYMMDD | `20260325` |

**Example**: `ch1-workspace-calm-morning-light-20260325.mp4`

### Tag Fields (Notion or Airtable Database)

Create a `stock-footage` database with these fields:

| Field | Type | Example |
|-------|------|---------|
| File name | Text | `ch1-workspace-calm-morning-light-20260325.mp4` |
| Channel | Single select | Channel 1 / Channel 2 / Shared |
| Category | Single select | Workspace, Tech, Time Metaphors, City Energy, etc. |
| Mood | Multi-select | Calm, Energized, Moody, Aspirational |
| Duration | Number (seconds) | `12` |
| Resolution | Single select | 1080p, 4K |
| Source | Single select | Pexels, Pixabay, Coverr, Mixkit |
| Source URL | URL | Link to original on Pexels |
| Download date | Date | 2026-03-25 |
| Attribution | Text | Pexels (not required but logged) |
| License type | Single select | Commercial free, Editorial only, Attribution required |
| Tags | Multi-select | desk, morning, sunlight, coffee, professional |
| Used in video | Text | `[Video ID / YouTube link]` |
| Notes | Text | `[Any issues, preferred usage]` |

### Search Tags Per Channel

**Channel 1 (Productivity)**:
`#desk-setup` `#laptop-work` `#notion-screen` `#calendar` `#clock` `#coffee-morning` `#standing-desk` `#notepad` `#pen-writing` `#window-light` `#clean-office` `#focused-work` `#monitor` `#timer` `#email` `#meeting` `#teamwork`

**Channel 2 (Growth)**:
`#city-energy` `#laptop-hustle` `#money-mindset` `#cafe-work` `#phone-income` `#side-hustle` `#aspirational` `#neon-night` `#urban-sunset` `#fast-cuts` `#social-media` `#laptop-income` `#startup-energy` `#motivation` `#sunrise` `#deal-handshake`

---

## 5. Curated Clip Catalog (Initial 60 Clips)

### Channel 1 — Productivity (30 clips)

#### Workspace Sets
1. `ch1-workspace-calm-morning-light-20260325.mp4` — Clean desk, window light, morning
2. `ch1-workspace-steady-desk-evening-20260325.mp4` — Same desk, evening lamp on
3. `ch1-workspace-standing-desk-20260325.mp4` — Person at standing desk, typing
4. `ch1-workspace-coffee-shop-20260325.mp4` — Laptop at busy coffee shop, warm light
5. `ch1-workspace-minimal-notebook-20260325.mp4` — Open notebook, pen, minimal setup

#### Tech Screens
6. `ch1-tech-laptop-code-dark-20260325.mp4` — Dark-themed code editor on laptop screen
7. `ch1-tech-spreadsheet-screen-20260325.mp4` — Spreadsheet on large monitor, morning light
8. `ch1-tech-phone-scroll-feed-20260325.mp4` — Phone scrolling social/email feed
9. `ch1-tech-ipad-pencil-note-20260325.mp4` — iPad with Apple Pencil writing notes
10. `ch1-tech-notion-dashboard-20260325.mp4` — Notion dashboard open on screen

#### Time Metaphors
11. `ch1-time-analog-clock-closeup-20260325.mp4` — Analog clock face, shallow DOF, ticking
12. `ch1-time-calendar-pages-turning-20260325.mp4` — Weekly planner, pages turning
13. `ch1-time-hourglass-sand-20260325.mp4` — Hourglass, sand running, calm
14. `ch1-time-sunset-to-night-20260325.mp4` — Timelapse: office window, sunset to dark
15. `ch1-time-digital-timer-countdown-20260325.mp4` — Timer counting down on screen

#### Focus Ambient
16. `ch1-focus-morning-window-light-20260325.mp4` — Person working at window, diffused light
17. `ch1-focus-rain-window-20260325.mp4` — Rain on window, person in background working
18. `ch1-focus-forest-trail-walk-20260325.mp4` — Person walking forest trail, peaceful
19. `ch1-focus-coffee-steam-20260325.mp4` — Coffee cup with steam, desk in background
20. `ch1-focus-notifications-off-20260325.mp4` — Phone face-down on desk, silent mode

#### Transitions
21. `ch1-trans-zoom-fade-desk-20260325.mp4` — Slow zoom into desk, fade to black
22. `ch1-trans-book-close-20260325.mp4` — Book closing, page flutter, fade to white
23. `ch1-trans-pen-drop-20260325.mp4` — Pen dropping on desk, sound synced

#### Human Moments
24. `ch1-human-hand-writing-20260325.mp4` — Hand writing in notebook, closeup
25. `ch1-human-thinking-at-window-20260325.mp4` — Person staring out window, thoughtful
26. `ch1-human-team-meeting-zoom-20260325.mp4` — Video call grid, 4 people on screen
27. `ch1-human-headphones-focus-20260325.mp4` — Person with headphones, focused on laptop
28. `ch1-human-laptop-stretch-20260325.mp4` — Person stretching after long work session
29. `ch1-human-whiteboard-ideas-20260325.mp4` — Person drawing on whiteboard, brainstorming
30. `ch1-human-water-bottle-20260325.mp4` — Water bottle on desk, minimal lifestyle

### Channel 2 — Growth (30 clips)

#### City Energy
31. `ch2-city-timelapse-sunset-20260325.mp4` — City skyline timelapse, sunset to neon
32. `ch2-city-busy-street-aerial-20260325.mp4` — Drone shot, busy intersection, daytime
33. `ch2-city-neon-night-rain-20260325.mp4` — Neon signs reflecting in wet street, night
34. `ch2-city-street-food-market-20260325.mp4` — Asian street food stall, steam, busy
35. `ch2-city-subway-entrance-20260325.mp4` — Person descending subway stairs, morning rush

#### Money / Income
36. `ch2-money-phone-laptop-income-20260325.mp4` — Phone showing payment notification, laptop beside it
37. `ch2-money-laptop-cafe-income-20260325.mp4` — Laptop at cafe, person smiling, work session
38. `ch2-money-laptop-graphs-up-20260325.mp4` — Laptop showing upward-trending graph line
39. `ch2-money-laptop-side-hustle-night-20260325.mp4` — Late night laptop session, room lit by screen
40. `ch2-money-stripe-dashboard-20260325.mp4` — Payment platform dashboard, earnings visible

#### Aspirational Moments
41. `ch2-asp-person-confident-laptop-20260325.mp4` — Person looking at camera, confident, laptop open
42. `ch2-asp-city-sunset-silhouette-20260325.mp4` — Silhouette against city sunset, arms up
43. `ch2-asp-creative-workspace-20260325.mp4` — Aesthetic workspace, plants, warm light, creative
44. `ch2-asp-handshake-deal-20260325.mp4` — Two people shaking hands, indoor, professional
45. `ch2-asp-laptop-rooftop-sunset-20260325.mp4` — Person on rooftop with laptop, city below

#### Fast Cuts
46. `ch2-fast-phone-scroll-fast-20260325.mp4` — Quick succession: phone screens scrolling
47. `ch2-fast-type-fast-hands-20260325.mp4` — Fast-motion: hands typing quickly
48. `ch2-fast-crosswalk-jog-20260325.mp4` — Person crossing busy crosswalk, quick pace
49. `ch2-fast-laptop-open-close-20260325.mp4` — Quick cuts: laptop opening in different locations

#### Motivation
50. `ch2-motv-sunrise-mountain-road-20260325.mp4` — Empty mountain road at sunrise, car headlights
51. `ch2-motv-airport-takeoff-20260325.mp4` — Plane taking off, POV from window seat
52. `ch2-motv-open-highway-aerial-20260325.mp4` — Aerial: long empty highway, horizon ahead
53. `ch2-motv-city-from-rooftop-20260325.mp4` — Looking out over city from rooftop, wide shot

#### Transitions
54. `ch2-trans-flash-cut-city-20260325.mp4` — Quick flash cut: city → laptop → street → person
55. `ch2-trans-swipe-up-urban-20260325.mp4` — Swipe up transition, black to city scene
56. `ch2-trans-glitch-reveal-20260325.mp4` — Glitch effect reveal of phone screen
57. `ch2-trans-text-appear-20260325.mp4` — Bold text appearing on screen, sync to audio beat

#### Human
58. `ch2-human-person-laughing-phone-20260325.mp4` — Person genuinely laughing at phone
59. `ch2-human-group-selfie-city-20260325.mp4` — Friends taking selfie, city background
60. `ch2-human-earbuds-walking-20260325.mp4` — Person walking with earbuds, confident stride

---

## 6. Download Log

Maintain `logs/stock-footage-log.md`:

```markdown
# Stock Footage Download Log

## Monthly Budget Tracking

**March 2026**
| Date | File | Channel | Source | Pexels Credit Used? |
|------|------|---------|--------|-------------------|

Remaining Pexels credits this month: ___
```

> Update this log immediately after every download to avoid hitting monthly limits unexpectedly.

---

## 7. Pexels API Quick Reference

```bash
# Search Pexels videos
curl -s -H "Authorization: $PEXELS_API_KEY" \
  "https://api.pexels.com/videos/search?query=clean+desk+workspace&per_page=5&orientation=landscape"

# Popular videos
curl -s -H "Authorization: $PEXELS_API_KEY" \
  "https://api.pexels.com/videos/popular?per_page=15"

# Download a video (returns video file URL)
curl -s -H "Authorization: $PEXELS_API_KEY" \
  "https://api.pexels.com/videos/videos/{video_id}/download"
```

**Pexels free tier**: 200 credits/month. A video download = 1 credit regardless of resolution.

---

*Last updated: 2026-03-25*
