# Discord Community Setup Guide — TKP Content Agency

> Implementation guide for TKP-46 (VID-35). Full Discord server setup for both channels,
> including server structure, roles, rules, onboarding, and 100-member launch plan.
>
> Related: [Community Management System](./community-management.md) · [Brand Identity](./brand-identity.md)

---

## Platform Decision: Discord vs. Alternatives

| Platform | Pros | Cons | Decision |
|----------|------|------|---------|
| Discord | Real-time chat, rich roles, bot ecosystem, creator-native | Requires Discord account, less discoverable | **Primary community space** |
| Facebook Group | Easy discovery, low friction | Algorithm suppression, limited features, older demographic | Secondary / repurposed existing community |
| Reddit | High discoverability, async, searchable | Hard to build personal connection, mod-heavy | Monitor/watch only, not build |
| Circle | Clean, creator-focused, good analytics | Paid tier needed for features | Consider for future if Discord fails |

**Recommendation**: Start with Discord as primary. Facebook Group as secondary for cross-posting and SEO discoverability.

---

## Server 1: TKP Productivity

**Server Name**: TKP Productivity Community
**Invite URL**: `[SET AFTER CREATION — use vanity URL: discord.gg/tkpproductivity]`
**Server Region**: `US East` (low latency for North American audience)

---

### Channel Structure

```
📁 CATEGORY: WELCOME & RULES
  #🏠 welcome
  #📜 rules
  #🎯 intro-stories        ← new members post their role + one productivity goal
  #📢 announcements        ← @everyone for new videos, muted by default

📁 CATEGORY: GENERAL
  #💬 chat                 ← open discussion, anything on your mind
  #💡 ideas                ← share and vote on content ideas for the channel
  #📋 weekly-review        ← share your weekly review format/template

📁 CATEGORY: SYSTEMS & TOOLS
  #🗂️ tool-reviews         ← discuss specific tools: Notion, Obsidian, Linear, Raycast, etc.
  #📊 time-tracking        ← how do you track where time goes?
  #📧 email-management      ← inbox zero strategies, email systems
  #🤝 meetings             ← meeting culture, async practices

📁 CATEGORY: RESOURCES
  #📚 resources            ← curated links: articles, books, videos
  #🎓 learning             ← share courses, certificates, learning paths
  #💼 career               ← job transitions, promotions, negotiation wins

📁 CATEGORY: COMMUNITY
  #🏆 wins                 ← share your productivity wins (no humbling, just results)
  #🤔 struggles           ← safe space to ask for help on stuck problems
  #🔴 off-topic            ← movies, fitness, whatever — keep it chill

📁 CATEGORY: MODERATOR (hidden — roles only)
  #🛡️ mod-chat
  #📝 mod-log
```

---

### Roles

| Role | Color | Who | Permissions |
|------|-------|-----|------------|
| `@Founder` | Gold `#C9A84C` | Creator/host | Admin, all channels |
| `@Moderator` | Navy `#1A2744` | Volunteer mods | Manage messages, kick, manage roles |
| `@Core Member` | Slate `#64748B` | Active participants (500+ messages) | Access to private channels, react with custom emoji |
| `@Weekly Contributor` | Warm White `#F8F7F4` | Posted a win or idea this week | Shown next to name as recognition |
| `@Member` | Default | Everyone else | Standard access |
| `@Newcomer` | Light gray | First 7 days | #intro-stories + #rules + #announcements only; upgrade to @Member after intro posted |

**Auto-role**: Bot assigns `@Newcomer` on join. Member posts in `#intro-stories` → bot auto-promotes to `@Member`.

---

### Rules (TKP Productivity)

```
TKP PRODUCTIVITY COMMUNITY — RULES

1. Be a trusted colleague, not a competitor.
   This is a space to share what works. No humble-brags, no "I do X better than Y."
   Share wins honestly. Ask for help without apologizing.

2. No hustle-culture gatekeeping.
   "You just need to wake up at 5am" is not welcome here.
   Productivity looks different for everyone. Respect the range.

3. Tools are neutral — people are not.
   You can love Notion and someone else can love Obsidian. Both are fine.
   Don't trash other people's systems without engaging with the substance.

4. No unsolicited coaching offers or paid services.
   If someone asks a question, answer it. Don't pitch your $500 course in replies.

5. Keep it SFW and respectful.
   No political threads, no hate speech, no harassment.

6. No spam or self-promotion.
   Share your own content only in #resources if it's genuinely relevant.
   If in doubt, ask a moderator first.

7. Privacy is a right, not a preference.
   Do not dox members. Do not share DMs publicly. Do not screenshot without warning.

→ Violations: warning → temp mute → removal. Hate speech = instant permanent ban.
```

---

### Onboarding Flow

**Step 1 — Welcome message** (automated via bot):
```
👋 Welcome to TKP Productivity Community, [username]!

We're a community of professionals who are tired of productivity advice that doesn't
work in the real world. Here's how to get started:

✅ Read the rules in #📜 rules
✅ Post your intro in #🎯 intro-stories (name, role, one goal for this week)
✅ Introduce yourself in #💬 chat

Once you've posted your intro, you'll get full access to the community.
Questions? Drop them in #💬 and someone will help.
```

**Step 2 — Intro prompt** (in `#intro-stories`):
```
Hey 👋 I'm [name/handle]. I'm a [your role — e.g. "product manager at a fintech startup"].
My main productivity goal right now is: [specific goal — e.g. "stop checking email first thing in the morning"].
One thing that actually worked for me recently: [optional — share something real].
```

**Step 3 — Auto-upgrade**: After posting in `#intro-stories`, bot assigns `@Member` role.

**Step 4 — 7-day check**: If `@Newcomer` hasn't posted intro after 7 days, bot sends reminder DM.

---

## Server 2: TKP Growth

**Server Name**: TKP Growth Community
**Invite URL**: `[SET AFTER CREATION — use vanity URL: discord.gg/tkpgrowth]`
**Server Region**: `US East`

---

### Channel Structure

```
📁 CATEGORY: WELCOME
  #🏠 welcome
  #📜 rules
  #🔥 intros               ← who are you and what's your current move?
  #📢 announcements       ← new videos + major wins, muted by default

📁 CATEGORY: THE MONEY MOVE
  #💸 income-stories       ← real numbers, real results — no humbling
  #🛠️ side-hustles        ← what are you building? share progress
  #💼 careers              ← job market, negotiation, promotions, transitions
  #📈 investing-basics     ← ETFs, index funds, first portfolio — no finance bro energy

📁 CATEGORY: SKILLS THAT PAY
  #🤖 ai-tools             ← share tools that actually saved you time or made money
  #💻 coding-basics        ← is coding worth learning? share resources
  #🎨 design-bootstrapping ← canva, figma, freelance design — real talk

📁 CATEGORY: THE WATER COOLER
  #💬 general              ← open chat
  #🤡 memes                ← the Gen Z equivalent of water cooler
  #❓ questions            ← no stupid questions (except ones answered by googling "is X worth it")
  #🌍 off-topic             ← travel, music, life — you're more than your hustle

📁 CATEGORY: COMMUNITY
  #🏆 wins                 ← you're allowed to be proud here. share it.
  #💬 accountability       ← weekly goals, check-ins
  #🔗 resources            ← free tools, courses, opportunities (no paid pitches)

📁 CATEGORY: MODERATOR (hidden)
  #🛡️ mod-chat
```

---

### Roles

| Role | Color | Who | Permissions |
|------|-------|-----|------------|
| `@Host` | Coral `#FF6B6B` | Creator/host | Admin |
| `@Moderator` | Violet `#7C3AED` | Volunteer mods | Manage messages, kick, manage roles |
| `@High Achiever` | Gold `#FACC15` | Posted an income/career win this month | Shown as badge; access to `#🏆 wins` spotlight rotation |
| `@Active Builder` | White | Contributed in last 7 days | Recognition badge |
| `@Member` | Default | Everyone else | Standard access |
| `@Newcomer` | Gray | First 3 days | Limited access until intro posted |

---

### Rules (TKP Growth)

```
TKP GROWTH COMMUNITY — RULES

1. Real numbers, real talk.
   If you made $X, say "$X." If you're struggling, say that too.
   No humbling ("I'm not sure if this counts but..." — it counts).

2. No gatekeeping.
   If someone is earlier in their journey than you, you were once there too.
   "When I was your age" is not a valid sentence in this server.

3. No MLM/hustle-culture recruitment.
   If your "business" requires recruiting others to make money — not welcome here.

4. Crypto/NFT shilling = instant ban.
   No exceptions. No explanations needed.

5. Disagree with ideas, not people.
   "That's a bad take" is fine. "You're an idiot" is not.

6. Self-promotion: the 10:1 rule.
   For every 1 post about your own work, contribute 10 substantive comments elsewhere first.

7. Privacy is yours.
   Do not share other people's DMs, income, or personal details without consent.

→ Violations: warning → mute → removal. Crypto spam = instant ban.
```

---

### Onboarding Flow

**Step 1 — Welcome message** (automated):
```
yo [username]! 👋 welcome to TKP Growth

this is where ambitious people share what they're actually building —
not what they're performing. real side hustles, real career moves, real numbers.

to get full access:
✅ read #📜 rules
✅ drop your intro in #🔥 intros
✅ say hi in #💬 general

once you've posted your intro, the good stuff opens up. 🔓

questions? ask in #❓ questions — no such thing as a dumb question here.
```

**Step 2 — Intro prompt** (in `#🔥 intros`):
```
yo — [name/handle] here 🫡

currently: [what you're working on right now — job, hustle, project]
the move: [your main goal for the next 90 days — specific]
last W: [your last win — doesn't have to be big, just real]
```

**Step 3 — Auto-upgrade**: Bot assigns `@Member` after intro posted.

**Step 4 — 3-day check**: Reminder DM if no intro posted. Newcomer access expires.

---

## Bots & Automation

### Required Bots

| Bot | Purpose | Permissions Needed |
|-----|---------|-------------------|
| **Mee6** (free tier) | Auto-role, welcome messages, leveling, basic mod | Manage roles, Send messages, Manage channels |
| **Carl-bot** (free tier) | Advanced role management, logging, reaction roles | Manage roles, Manage channels, View audit log |
| **Apollo** (Discord native, no install) | Event scheduling, reminders | Manage channels |
| **Statbot** (free) | Member count, server stats for announcements | View channels |

### Bot Configuration Checklist

- [ ] Set up Mee6 welcome message for both servers
- [ ] Configure Mee6 auto-role: `@Newcomer` on join (both servers)
- [ ] Set up leveling: `@Core Member` / `@Active Builder` at 100 messages (Productivity) and 50 messages (Growth)
- [ ] Configure Carl-bot logging: join/leave log, mod action log (both servers)
- [ ] Set up Apollo event reminders: weekly community calls if applicable
- [ ] Set up Statbot: show member count in `#🏠 welcome` channel topic

### Custom Emoji Set (Per Server)

**TKP Productivity emoji** (upload to Discord):
- 🏆 (win), 📊 (data), 🧠 (insight), ✅ (tip), ❓ (question), 💬 (chat)
- 📧 (email), 🗓️ (schedule), 🛠️ (tools)

**TKP Growth emoji**:
- 🔥 (win/energy), 💸 (money), 🛠️ (side hustle), 🚀 (growth), 💬 (chat)
- ⚡ (quick tip), ❓ (question)

---

## Launch Plan: 100 Initial Members

### Phase 1 — Pre-Launch (2 weeks before)

- [ ] Create both Discord servers
- [ ] Configure bots, roles, channels, welcome messages
- [ ] Write all rules and onboarding flows
- [ ] Set vanity invite URLs (`discord.gg/tkpproductivity`, `discord.gg/tkpgrowth`)
- [ ] Post Discord link in YouTube community tab + video descriptions (existing backlog)

### Phase 2 — Soft Launch (Week 1, target: 20 members)

- [ ] Share invite link in existing YouTube video descriptions (add to pinned comment on high-traffic videos)
- [ ] Share in TikTok bio link (linktree or similar)
- [ ] Share in Instagram bio
- [ ] Post in LinkedIn personal feed: "I just launched a free community for [channel niche] — come say hi"
- [ ] Invite 5–10 personal contacts / early viewers individually

**Target**: 20 members from existing audience at launch

### Phase 3 — Active Growth (Weeks 2–4, target: 80 more members)

- [ ] Add Discord link to ALL new video descriptions (permanent fixture)
- [ ] Mention Discord in videos: 15-second CTA in videos 3–4 (not every video — avoid fatigue)
- [ ] CTA in TikTok captions: "link in bio for the free community"
- [ ] Community member referral: ask active members to invite 1 person ("bring someone who'd get value from this")
- [ ] Cross-promote: if audience overlaps, mention both Discords

**Target**: 80 total members by end of week 4

### Phase 4 — Retention & Culture (Ongoing)

- [ ] Post in `#🏆 wins` and `#🔥 intros` channels yourself 3x/week (creator presence matters)
- [ ] Pin 1–2 standout community wins per week in `#📢 announcements`
- [ ] Use `#💡 ideas` / `#🛠️ side-hustles` to collect content ideas — credit the member in the video
- [ ] Run monthly "community call" (Discord stage channel or live YouTube) — announce in `#📢 announcements`

### Growth Targets

| Metric | Week 1 | Week 4 | Month 3 |
|--------|--------|--------|---------|
| Total members | 20 | 80 | 200 |
| Active weekly | 8 | 35 | 80 |
| Channel messages/week | 30 | 150 | 400 |
| Content ideas from community | 1 | 5 | 15 |

---

## Moderator Recruitment (After 50 Members)

When to recruit:
- Start looking for 1–2 volunteer mods after hitting 50 active members
- Recruit from active contributors: people who consistently post in `#🏆 wins`, answer questions in `#❓`, and follow rules

Mod candidate criteria:
- Active 3+ weeks, 100+ messages
- Never had a rule warning
- Demonstrated helpful, non-dramatic energy
- Aligned with brand voice (calm for Productivity; direct for Growth)

Mod onboarding:
1. DM invite: offer mod trial for 2 weeks
2. Give access to `#🛡️ mod-chat` and explain escalation path
3. Check in weekly for first month
4. Confirm permanently or release — no indefinite trial period

---

*Last updated: 2026-03-25*
