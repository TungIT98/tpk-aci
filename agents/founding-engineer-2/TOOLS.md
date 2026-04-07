# TOOLS.md -- Founding Engineer 2 Toolset

## Available Tools

### Code & Scripting
- **Node.js** (`node`) -- primary scripting runtime. All pipeline scripts are Node.js.
- **npm/pnpm** -- package management.
- **Bash** -- running scripts, git, file operations.

### APIs Available (from .env)
- **MiniMax Anthropic-compatible API** (`ANTHROPIC_BASE_URL` + `ANTHROPIC_TOKEN_KEY`) -- LLM calls (MiniMax-M2 model, 100 tps).
- **MiniMax Native API** (`MINIMAX_BASE_URL`) -- image generation, TTS, video generation, music generation. Same token key as above.
  - Video: `POST /v1/video_generation` -- model `film.03` (3/day limit)
  - TTS: `POST /v1/t2a_v2` -- model `speech-2.8-hd` ✅ verified
  - Image: `POST /v1/image_generation` -- model `image-01`
- **ElevenLabs** (`ELEVENLABS_API_KEY`) -- voice synthesis (10000 chars/month free).
- **Pexels** (`PEXELS_API_KEY`) -- stock footage (200 credits/month).
- **TikTok Creator API** (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_APP_ID`) -- posting and analytics.
- **Ollama** (`OLLAMA_HOST`) -- local LLM fallback.

### File System
- Workspace root: `C:\Users\PC\.paperclip\instances\default\workspaces\TKP_ACI`
- Agent home: `agents/founding-engineer-2/`
- Lib: `lib/` -- shared modules (hailuo.js, etc.)
- Scripts: `scripts/` -- standalone automation scripts

### NOT Available
- Python runtime (not installed/configured)
- Stability AI (placeholder key only)
- Pictory, Synthesia (no keys configured)

## Conventions

- All scripts use ES modules (`import/export`) with Node.js.
- Environment variables loaded via `dotenv` from `.env`.
- All API calls include error handling with retry logic.
- Cost tracking logged to `logs/hailuo-costs.md` per session.
