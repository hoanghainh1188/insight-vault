# InsightVault — a local-first knowledge assistant

**English** · [Tiếng Việt](README.vi.md)

InsightVault is a **desktop app (macOS + Windows)** for asking questions about your own documents with AI —
like NotebookLM, but **running entirely on your machine**. Add documents to a notebook; InsightVault parses
and indexes them locally, then answers questions and writes summaries with a local LLM. Every answer carries
**verifiable citations**: click a `[n]` chip and the source opens at the exact page, passage or timestamp,
highlighted.

> Built for people who work with many documents and care about privacy — researchers, lawyers, journalists,
> students, engineers — especially with sensitive material you don't want to upload to a third-party server.

## Core principles

- **Local-first** — your data never leaves your machine in the default mode.
- **Verifiable** — every answer cites the exact source passage (page / timestamp / text span), and the
  model is not allowed to make up citations: if nothing in your sources answers the question, it says so.
- **Offline & self-sufficient** — works without an Internet connection; you control the models and the cost.

## Features

- **Sources:** PDF (reading order and tables preserved, multi-column layouts), `.docx`, `.txt`, `.md`,
  web pages (URL), **audio** (`.wav` `.mp3` `.flac` `.ogg` `.m4a` `.aac` — transcribed locally with Whisper),
  **video** (`.mp4` `.mov` `.webm` `.mkv`), **images** (`.png` `.jpg` `.webp` `.bmp` `.tiff` — local OCR,
  Vietnamese + English).
- **Chat with citations** — streamed answers, hybrid retrieval (vector + full-text), "grounded" mode that
  refuses to answer outside your sources, or "extended" mode that is clearly labelled.
- **Relevance checker** — a small local model checks whether the retrieved passages actually answer the question, so
  questions your sources don't cover get "Not found in the sources" right away instead of a guess (downloaded once,
  ~120 MB; Q&A works as before until it's ready).
- **Source viewer** — opens the cited passage highlighted; audio/video jump to the cited timestamp; images
  show the recognised text region.
- **Studio** — 8 notebook-wide outputs: summary, key points, FAQ, outline, study guide, briefing, timeline and
  glossary — plus a **custom request** box (your own instruction, up to 500 characters). Pick **a few sources** as
  the scope, watch the text appear as the AI writes (cancel any time), and keep the **last 10 versions** of each
  output to revisit or delete. Large notebooks are processed in parts while keeping citations exact. Copy or export
  to Markdown.
- **Optional online AI** — use Claude, Gemini or OpenAI with **your own API key** (stored in the OS
  keychain). A privacy badge shows whenever anything is sent off the machine; one click falls back to the
  local model.
- **Backup & restore** — export the whole vault to one `.ivbackup` file, optionally encrypted with a
  password (AES-256-GCM).
- **English and Vietnamese interface** — follows your system language on first launch; switch any time in
  **Settings › Language** (applies instantly). Chat answers in the language of your question; Studio writes in the
  interface language.
- Full-text search across sources, chat history, keyboard shortcuts, screen-reader announcements.

## Install

1. Download the latest installer from [Releases](https://github.com/hoanghainh1188/insight-vault/releases/latest):
   `InsightVault-<version>-arm64.dmg` (macOS, Apple Silicon) or `InsightVault-<version>-Setup.exe` (Windows x64).
2. Install [Ollama](https://ollama.com) and pull a chat model, for example `ollama pull qwen2.5:7b`
   (the app suggests models that fit your RAM). Embeddings, the relevance checker, transcription and OCR run inside the app —
   their models are downloaded once on first use.
3. The builds are **not code-signed yet**:
   - macOS: right-click the app → **Open**, or run `xattr -dr com.apple.quarantine /Applications/InsightVault.app`.
   - Windows: SmartScreen → **More info → Run anyway**.

## Development

```bash
npm install
npm run dev        # Electron window with renderer HMR
```

| Command                  | What it does                                           |
| ------------------------ | ------------------------------------------------------ |
| `npm run lint`           | prettier --check + eslint + tsc                        |
| `npm test`               | Vitest unit tests + coverage (≥ 80% business logic)    |
| `npm run build`          | lint + electron-vite build (main / preload / renderer) |
| `npm run test:e2e`       | Playwright `_electron` (needs a build and a display)   |
| `npm run eval:retrieval` | retrieval-quality evaluation on a public test corpus   |
| `npm run dist`           | package installers with electron-builder               |

### Tech stack

| Layer                  | Technology                                                         |
| ---------------------- | ------------------------------------------------------------------ |
| Desktop shell          | Electron + electron-vite                                           |
| UI                     | React 18 + TypeScript + Vite · Zustand · TanStack Query            |
| Metadata + full-text   | SQLite (FTS5), main process                                        |
| Vector store           | LanceDB (embedded)                                                 |
| Embeddings / ASR / OCR | transformers.js (multilingual-e5-small, Whisper) · tesseract.js    |
| Chat LLM               | Ollama (local) · optional Claude / Gemini / OpenAI                 |
| Parsing & viewer       | pdf.js · mammoth · Readability + turndown · ffmpeg (audio extract) |
| Secrets                | keytar (OS keychain)                                               |
| Tests                  | Vitest · Playwright `_electron`                                    |

**Security boundary:** the renderer runs with `sandbox`, `contextIsolation` and no Node integration; all
file-system, database, model and network access lives in the **main process** behind a whitelisted
`preload` bridge. There is **no network egress by default**.

### Project layout

```
src/
├── main/        # Electron main process: ipc/, services/<feature>/
├── preload/     # typed, whitelisted contextBridge API
├── renderer/    # React: app/, features/<feature>/, shared/ (UI kit)
└── shared/      # shared types + IPC channel contract
tests/           # unit/ (Vitest) · e2e/ (Playwright) · eval/ (retrieval evaluation)
docs/            # product overview, glossary, decisions (ADRs), feature intakes
specs/           # per-feature spec / plan / tasks (GitHub Spec Kit)
```

Design documents, decision records (ADRs) and feature specs are written in **Vietnamese**; the glossary
[`docs/00-glossary.md`](docs/00-glossary.md) maps every domain term to its English name used in code.

## Contributing

Bug reports and ideas are welcome — issues can be written in English or Vietnamese.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](LICENSE).

**Third-party:** ffmpeg is bundled via `ffmpeg-static` (used to extract audio from video) and is licensed
under the **GPL**; its licence is shipped with the app (`node_modules/ffmpeg-static/ffmpeg.LICENSE`).
