# Trailer Pipeline Inputs — TKP Content Agency
> TKP-33 execution-ready inputs for `lib/video-pipeline.js --trailer`.
> Copy-paste the `TRAILER_PRODUCTIVITY` or `TRAILER_GROWTH` objects into the pipeline.
> Generated from: `content/trailer-production-brief.md`, `content/trailer-shot-list.md`.

---

## TKP Productivity Trailer — Full Pipeline Input

```js
const TRAILER_PRODUCTIVITY = {
  channel: 'productivity',
  title: 'TKP Productivity — Channel Trailer',
  duration: 56,
  format: '16:9',
  music: 'ambient-calm',
  voice: {
    engine: 'sapi',       // Windows SAPI fallback — David voice
    rate: 1.0,
    stability: 0.50,
    similarity: 0.75,
  },
  scenes: [
    {
      id: 'prod-01',
      timestamp: [0, 4],
      vo: 'Every morning, you sit down to work...',
      visual: {
        type: 'ai-video',
        prompt: 'Real cluttered knowledge worker desk, scattered papers and open laptop browser tabs with multiple notifications, phone buzzing with screen glowing, coffee mug half empty, morning natural light slightly overexposed, casual mess not staged, warm office environment, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-02',
      timestamp: [4, 8],
      vo: '...and before 9am, your focus is already gone.',
      visual: {
        type: 'ai-video',
        prompt: 'Side profile of young professional looking at phone screen blue light glow, slightly tired expression, scrolling social media, desk setup background slightly messy, warm lamp light mixing with phone screen blue light, realistic office environment, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-03a',
      timestamp: [8, 11],
      vo: 'Meetings pile up.',
      visual: {
        type: 'ai-video',
        prompt: 'Google Calendar completely full day view, all day blocked with back-to-back meetings in blue and green blocks, laptop screen macro shot, morning light, productivity apps open side by side, overwhelming schedule visualization, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-03b',
      timestamp: [11, 14],
      vo: 'Inboxes overflow. Your priorities get buried.',
      visual: {
        type: 'ai-video',
        prompt: 'Email inbox open showing 47 unread messages notification badge glowing red, Gmail interface slightly dark mode, professional laptop screen, notifications piling up, morning desk scene, realistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-04',
      timestamp: [14, 20],
      vo: 'But what if you had a system? One that actually survives real life?',
      visual: {
        type: 'ai-video',
        prompt: 'Person deliberately placing phone face-down on clean wooden desk with gentle thud, then closing laptop slowly, taking a calm deep breath, golden morning light streaming through window behind them, moment of stillness and intention, warm natural lighting, photorealistic, 768p, cinematic, slow motion feel',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-05',
      timestamp: [20, 28],
      vo: 'TKP Productivity. Evidence-based systems for knowledge workers who are tired of advice that doesn\'t work.',
      visual: {
        type: 'ai-video',
        prompt: 'Beautiful organized minimalist home office desk, clean wooden surface, open laptop showing Notion productivity board with colored blocks, Sony noise-cancelling headphones resting on desk, clean white ceramic coffee mug full of coffee, warm golden morning light, navy blue and gold accent notebook, calm professional person not directly looking at camera, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-06a',
      timestamp: [28, 31],
      vo: 'Time systems.',
      visual: {
        type: 'ai-video',
        prompt: 'iPad or laptop screen showing color-coded weekly calendar with clear focus blocks in navy and gold, morning light on desk, clean minimalist setup, productivity system visible, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-06b',
      timestamp: [31, 34],
      vo: 'Smart tools.',
      visual: {
        type: 'ai-video',
        prompt: 'Email inbox at zero unread messages, clean Gmail interface, peaceful desktop setup, morning light, calm productivity, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-06c',
      timestamp: [34, 36],
      vo: 'Routines that don\'t fall apart by Wednesday.',
      visual: {
        type: 'ai-video',
        prompt: 'Cozy evening desk scene, open journal with handwritten notes, ceramic tea cup with steam rising, small plant nearby, warm lamp light, reading glasses, peaceful evening routine atmosphere, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'prod-07',
      timestamp: [36, 44],
      vo: 'No hustle culture. No 5am club. Just systems that work.',
      visual: {
        type: 'text-card',
        background: '#1A2744',
        text: 'No hustle culture.\nNo 5am club.\nJust systems that work.',
        accent: '#C9A84C',
        font: 'DM Sans Bold',
      },
    },
    {
      id: 'prod-08',
      timestamp: [44, 52],
      vo: 'Subscribe to TKP Productivity. New videos every Tuesday and Friday.',
      visual: {
        type: 'brand-card',
        background: '#1A2744',
        logo: 'assets/logos/tkp-productivity-pfp.svg',
        schedule: 'New videos: Tuesday & Friday',
        accent: '#C9A84C',
      },
    },
    {
      id: 'prod-09',
      timestamp: [52, 56],
      vo: 'Work less. Get more done.',
      visual: {
        type: 'text-card',
        background: '#1A2744',
        text: 'Work less.\nGet more done.',
        accent: '#C9A84C',
        font: 'DM Sans Bold',
        cta: 'SUBSCRIBE',
      },
    },
    {
      id: 'prod-10',
      timestamp: [56, 60],
      vo: null,
      visual: {
        type: 'end-card',
        logo: 'assets/logos/tkp-watermark-prod.svg',
        music: 'fade-out',
      },
    },
  ],
};
```

---

## TKP Growth Trailer — Full Pipeline Input

```js
const TRAILER_GROWTH = {
  channel: 'growth',
  title: 'TKP Growth — Channel Trailer',
  duration: 56,
  format: '16:9',
  music: 'energetic-beat',
  voice: {
    engine: 'sapi',       // Windows SAPI fallback — Josh voice
    rate: 1.1,
    stability: 0.35,
    similarity: 0.85,
  },
  scenes: [
    {
      id: 'growth-01',
      timestamp: [0, 5],
      vo: 'Someone made $3,200 last month doing something you could start this weekend.',
      visual: {
        type: 'ai-video',
        prompt: 'Bold financial number $3,200 appearing on screen in neon yellow on pure black dark background, motion graphic style text animation, electric energy, modern fintech aesthetic, cinematic dramatic lighting, 768p, high energy',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-02a',
      timestamp: [5, 7],
      vo: 'Not a fluke.',
      visual: {
        type: 'ai-video',
        prompt: 'Phone screen close-up showing payment received notification, Stripe or PayPal interface, $3,200 amount highlighted in green, professional authentic moment, realistic phone photography, dark moody lighting, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-02b',
      timestamp: [7, 10],
      vo: 'Not a one-off. A system.',
      visual: {
        type: 'ai-video',
        prompt: 'Young person 20s working on laptop in stylish coffee shop, laptop screen glowing, city street visible through large window, natural light mixed with warm interior lighting, authentic urban freelance lifestyle, confident energy, real not staged, photorealistic, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-03',
      timestamp: [10, 16],
      vo: 'TKP Growth. Real income. Real careers. Real skills. No guru BS.',
      visual: {
        type: 'text-card',
        background: '#7C3AED',
        text: 'TKP GROWTH\nReal income. Real careers.\nReal skills. No guru BS.',
        accent: '#FACC15',
        font: 'Bebas Neue Bold',
      },
    },
    {
      id: 'growth-04a',
      timestamp: [16, 18],
      vo: 'Every week: income breakdowns...',
      visual: {
        type: 'ai-video',
        prompt: 'Dark background financial dashboard showing income graph trending upward in neon green and yellow, professional finance app interface, bold number callouts, energetic Gen Z aesthetic, 768p, cinematic motion graphic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-04b',
      timestamp: [18, 20],
      vo: '...career moves that work...',
      visual: {
        type: 'ai-video',
        prompt: 'LinkedIn or email notification on phone screen showing job offer or promotion, celebratory green checkmark, confident professional message, dark moody background, bold interface design, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-04c',
      timestamp: [20, 24],
      vo: '...and skills that compound.',
      visual: {
        type: 'ai-video',
        prompt: 'Course completion certificate or skill badge on laptop screen, learning and growth aesthetic, dark mode interface with violet and yellow accents, 768p, cinematic',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-05',
      timestamp: [24, 32],
      vo: 'This is not motivation. This is a playbook.',
      visual: {
        type: 'text-card',
        background: '#7C3AED',
        text: 'THIS IS NOT MOTIVATION.\nTHIS IS A PLAYBOOK.',
        accent: '#FACC15',
        font: 'Bebas Neue Bold',
        style: 'color-block',  // violet rectangle behind text
      },
    },
    {
      id: 'growth-06',
      timestamp: [32, 40],
      vo: 'Your next level starts here.',
      visual: {
        type: 'text-card',
        background: '#7C3AED',
        text: 'YOUR NEXT LEVEL\nSTARTS HERE',
        accent: '#FACC15',
        font: 'Bebas Neue Bold',
        icon: 'lightning',
      },
    },
    {
      id: 'growth-07',
      timestamp: [40, 50],
      vo: 'Follow TKP Growth. New content every day. This is just getting started.',
      visual: {
        type: 'ai-video',
        prompt: 'Dark background with electric violet #7C3AED and hot coral #FF6B6B gradient, fast energetic content collage showing phone screens with YouTube thumbnails and TikTok video previews, bold TKP Growth logo appearing, neon yellow #FACC15 lightning accent, high energy Gen Z aesthetic, 768p, cinematic motion',
        duration: 6,
        model: 'hailuo-2.3-fast-768p',
      },
    },
    {
      id: 'growth-08',
      timestamp: [50, 56],
      vo: 'Your next level. Let\'s go.',
      visual: {
        type: 'text-card',
        background: '#111827',
        text: "LET'S GO",
        accent: '#FF6B6B',
        font: 'Bebas Neue Bold',
        style: 'fire',
        icon: 'fire-lightning',
      },
    },
    {
      id: 'growth-09',
      timestamp: [56, 60],
      vo: null,
      visual: {
        type: 'end-card',
        logo: 'assets/logos/tkp-watermark-growth.svg',
        cta: 'SUBSCRIBE',
        music: 'beat-drop',
      },
    },
  ],
};
```

---

## TTS Script Sheets

### TKP Productivity VO Script

```
SCENE  TIMECODE  DIALOGUE
──────────────────────────────────────────────────────────────
01     0:00-0:04  "Every morning, you sit down to work..."
02     0:04-0:08  "...and before 9am, your focus is already gone."
03     0:08-0:14  "Meetings pile up. Inboxes overflow. Your priorities get buried."
04     0:14-0:20  "But what if you had a system? One that actually survives real life?"
05     0:20-0:28  "TKP Productivity. Evidence-based systems for knowledge workers who are tired of advice that doesn't work."
06     0:28-0:36  "Time systems. Smart tools. Routines that don't fall apart by Wednesday."
07     0:36-0:44  "No hustle culture. No 5am club. Just systems that work."
08     0:44-0:52  "Subscribe to TKP Productivity. New videos every Tuesday and Friday."
09     0:52-0:56  "Work less. Get more done."
10     0:56-1:00   [MUSIC FADE — no VO]

Total VO: ~52 seconds
Voice settings: SAPI David, rate 1.0x, calm authority tone
```

### TKP Growth VO Script

```
SCENE  TIMECODE  DIALOGUE
────────────────────────────────────────────────────────────────
01     0:00-0:05  "Someone made $3,200 last month doing something you could start this weekend."
02     0:05-0:10  "Not a fluke. Not a one-off. A system."
03     0:10-0:16  "TKP Growth. Real income. Real careers. Real skills. No guru BS."
04     0:16-0:24  "Every week: income breakdowns, career moves that work, and skills that compound."
05     0:24-0:32  "This is not motivation. This is a playbook."
06     0:32-0:40  "Your next level starts here."
07     0:40-0:50  "Follow TKP Growth. New content every day. This is just getting started."
08     0:50-0:56  "Your next level. Let's go."
09     0:56-1:00   [MUSIC DROP — no VO]

Total VO: ~50 seconds
Voice settings: SAPI Josh, rate 1.1x, energetic Gen Z delivery
```

---

## Post-Render Checklist

After video is rendered, run through before upload:

- [ ] Frame 0:00–0:03 — Does the hook grab attention immediately?
- [ ] Both trailers — Is the subscribe CTA in the final 5 seconds?
- [ ] Productivity — Does the brand color scheme (navy/gold) appear in first 5 seconds?
- [ ] Growth — Does the $3,200 number appear in first 5 seconds?
- [ ] Both — Is music rights-cleared (YouTube Audio Library)?
- [ ] Both — Is TKP watermark present on all frames?
- [ ] Both — Is total duration ≤ 60 seconds?
- [ ] Both — Does 9:16 clip variant cut at the strongest moment (0:00–0:30)?
- [ ] YouTube — Is trailer set as channel trailer in YouTube Studio → Customization → Layout
- [ ] TikTok — Is clip uploaded with caption: "Finally — a channel that actually works. Link in bio." / "New channel. Real results. No BS. Link in bio."
