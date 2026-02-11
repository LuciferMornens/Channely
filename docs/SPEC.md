# Channely — System-Wide AI Text Improvement Tool

> **Real-time AI-powered proofreading & text enhancement that works everywhere on your Mac.**
> Select text in *any* app — Terminal, Discord, Telegram, Slack, browser, Notes, anywhere — hit a hotkey, and get instant AI-polished text back.

---

## Overview

Channely is a macOS system tray application that intercepts selected text from any application, sends it to an AI model for grammar, spelling, clarity, and tone improvements, and presents the user with a beautifully designed floating overlay showing a before/after diff. One keystroke to accept — the corrected text replaces the original.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Runtime     | **Tauri 2.0** (Rust core + webview) |
| Frontend    | **React 18** + **TailwindCSS 4**    |
| Backend     | **Rust** (Tauri commands)           |
| AI          | **Cerebras Inference** — `gpt-oss-120b` with `reasoning_effort: "high"`, SSE streaming |
| Platform    | **macOS** first (Windows/Linux planned) |
| Testing     | **Vitest** (frontend) + **Rust tests** (backend) + **Playwright/WebdriverIO** (E2E) |
| Build       | **pnpm** (package manager)          |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    macOS System                       │
│                                                      │
│  ┌──────────┐    ① Select text                       │
│  │ Any App  │────────────────┐                       │
│  │ Terminal │                │                       │
│  │ Discord  │    ② Global    │                       │
│  │ Telegram │    Hotkey      │                       │
│  │ Browser  │    (Cmd+Shift+K)                       │
│  └──────────┘                │                       │
│                              ▼                       │
│              ┌───────────────────────────┐            │
│              │      Channely (Tray App)  │            │
│              │                           │            │
│              │   ┌─────────────────────┐ │            │
│              │   │    Rust Backend     │ │            │
│              │   │                     │ │            │
│              │   │  ├─ Global Hotkey   │ │            │
│              │   │  │  Listener        │ │            │
│              │   │  │                  │ │            │
│              │   │  ├─ Clipboard       │ │            │
│              │   │  │  Manager         │ │            │
│              │   │  │  (read/write +   │ │            │
│              │   │  │   preserve)      │ │            │
│              │   │  │                  │ │            │
│              │   │  ├─ AI Client       │ │            │
│              │   │  │  (multi-provider │ │            │
│              │   │  │   + streaming)   │ │            │
│              │   │  │                  │ │            │
│              │   │  ├─ Text Differ     │ │            │
│              │   │  │  (word-level     │ │            │
│              │   │  │   diffing)       │ │            │
│              │   │  │                  │ │            │
│              │   │  └─ macOS A11y API  │ │            │
│              │   │     (text field     │ │            │
│              │   │      detection)     │ │            │
│              │   └─────────────────────┘ │            │
│              │                           │            │
│              │   ┌─────────────────────┐ │            │
│              │   │  React Frontend     │ │            │
│              │   │                     │ │            │
│              │   │  ├─ Floating Popup  │ │            │
│              │   │  │  (diff overlay)  │ │            │
│              │   │  │                  │ │            │
│              │   │  ├─ Settings Panel  │ │            │
│              │   │  │                  │ │            │
│              │   │  ├─ Onboarding      │ │            │
│              │   │  │  Flow            │ │            │
│              │   │  │                  │ │            │
│              │   │  └─ Style Presets   │ │            │
│              │   │     UI              │ │            │
│              │   └─────────────────────┘ │            │
│              └───────────────────────────┘            │
│                              │                       │
│              ③ Floating overlay appears               │
│              ④ Accept (Tab/Enter) → replaces text     │
│              ④ Dismiss (Esc) → nothing changes        │
└──────────────────────────────────────────────────────┘
```

---

## Core User Flow (MVP)

```
1. User types text in ANY macOS application
2. User selects the text they want improved (Cmd+A or manual select)
3. User presses global hotkey: Cmd+Shift+K (configurable)
4. Channely:
   a. Simulates Cmd+C to copy selected text (preserving existing clipboard)
   b. Reads the copied text
   c. Sends it to configured AI provider
   d. Receives improved version
   e. Shows floating overlay near cursor with:
      - Original text (with red strikethrough on changes)
      - Improved text (with green highlights on changes)
      - Word-level diff visualization
5. User presses:
   - Tab or Enter → accept: improved text replaces selection via simulated paste
   - Esc → dismiss: nothing changes, original clipboard restored
   - Arrow keys → cycle through alternative suggestions (if multiple)
6. Floating overlay disappears
7. Original clipboard contents are restored
```

---

## Permissions Required

| Permission           | Why                                             | macOS API                    |
|----------------------|-------------------------------------------------|------------------------------|
| **Accessibility**    | Read/write focused text fields, simulate keystrokes | `AXUIElement`, `CGEventPost` |
| **Network**          | AI API calls                                    | Standard networking          |

> **Note**: Clipboard access does NOT require a separate permission on macOS.

---

## UI Design Principles

- **Flawlessly polished** — every pixel matters, pro-grade UI
- **Minimal & non-intrusive** — floating overlay, not a full window
- **Dark/Light mode** — auto-detect macOS system appearance
- **Buttery smooth animations** — Framer Motion for all transitions
- **Glass morphism** — frosted glass effect matching macOS aesthetic
- **Consistent with macOS design language** — native-feeling, SF Pro font
- **Micro-interactions** — subtle hover states, smooth appear/disappear
- **Keyboard-first** — everything accessible without touching the mouse

### Floating Overlay Design

```
┌─────────────────────────────────────────────┐
│  ✨ Channely                    ⚙  ✕       │
├─────────────────────────────────────────────┤
│                                             │
│  "i dont want extension coz, for example"   │  ← original (subtle, muted)
│                                             │
│  "I don't want an extension because, for   │  ← improved (prominent)
│   example"                                  │
│                                             │
├─────────────────────────────────────────────┤
│  ⌨ casual  ○ professional  ○ concise       │  ← style presets
├─────────────────────────────────────────────┤
│  Tab accept  ·  Esc dismiss  ·  ⌘Z undo   │  ← action hints
└─────────────────────────────────────────────┘
```

### System Tray

- Menubar icon (minimal, monochrome, fits macOS aesthetic)
- Click → dropdown with:
  - Current status (active/paused)
  - Quick toggle on/off
  - Style preset selector
  - Statistics (texts improved today)
  - Settings
  - Quit

### Settings Window

- Clean tabbed interface
- Tabs: General / AI Provider / Hotkeys / Style / About
- General: launch at login, theme, language
- AI Provider: provider selector, API key input, model picker, test connection button
- Hotkeys: customizable global shortcut recorder
- Style: preset management, custom rules
- About: version, links, credits

---

## AI Integration

### Provider: Cerebras Inference

Channely uses **Cerebras Inference** exclusively — the fastest inference platform available.

- **Base URL**: `https://api.cerebras.ai/v1`
- **Endpoint**: `/chat/completions` (OpenAI-compatible)
- **Model**: `gpt-oss-120b`
- **Reasoning**: `reasoning_effort: "high"` (only supported on `gpt-oss-120b`)
- **Streaming**: SSE via `stream: true`
- **Auth**: `Bearer` token (API key stored securely, never in frontend/WebView)

> **Security**: The Tauri frontend is a WebView — same as a browser. The API key MUST live in the Rust backend only. For dev: `CEREBRAS_API_KEY` env var. For production: Tauri Stronghold plugin (encrypted storage).

### Prompt Strategy

```
System: You are a text proofreader. Fix grammar, spelling, punctuation, and improve
clarity while preserving the author's voice and intent. Do NOT change the meaning.
Do NOT add information. Keep the same tone and formality level.
Return ONLY the corrected text, nothing else.

Style modifier (if selected):
- casual: Keep it casual and natural. Use contractions. Be conversational.
- professional: Make it polished and professional. Proper grammar throughout.
- concise: Make it shorter. Remove filler words. Be direct.
- friendly: Warm and approachable tone. Keep it natural.

User: {selected_text}
```

> Note: Cerebras treats `role: "system"` as a strong developer-level instruction layer for `gpt-oss-120b`, so the system prompt has extra weight.

### Request Shape

```rust
struct CerebrasRequest {
    model: "gpt-oss-120b",
    messages: Vec<ChatMessage>,
    stream: true,
    max_completion_tokens: 32768,  // includes reasoning tokens
    temperature: 1.0,
    top_p: 1.0,
    reasoning_effort: "high",
}
```

### Streaming Architecture

```
Rust Backend                              Frontend (WebView)
─────────────                             ──────────────────
POST /chat/completions                    
  ← SSE stream                           
  parse event.data                        
  extract delta.content                   
  window.emit("cerebras:delta", token) ──→ listen("cerebras:delta")
  window.emit("cerebras:reasoning", r) ──→ (hidden from user)
  ...                                     append tokens to UI
  [DONE]                                  
  window.emit("cerebras:done", ()) ─────→ listen("cerebras:done")
```

### Response Handling

- **Streaming**: Tokens emitted via Tauri events as they arrive
- **Reasoning tokens**: Captured but hidden from end users (per Cerebras guidance)
- **Timeout**: 30 seconds max (model is large, give it time)
- **Retry**: 1 automatic retry on failure
- **Error handling**: Non-2xx status → parse error body → user-friendly message

---

## Data & Privacy

- **No text is stored** — text is sent to Cerebras, response is shown, nothing persisted
- **API key in Rust backend only** — never exposed to WebView/frontend
- **Dev**: `CEREBRAS_API_KEY` env var
- **Prod**: Tauri Stronghold plugin (encrypted on-device storage)
- **Clipboard is preserved** — original clipboard restored after operation
- **All processing is ephemeral** — no logs, no history (unless user opts in)

---

## Configuration File

Stored at `~/Library/Application Support/com.channely.app/config.toml`:

```toml
[general]
launch_at_login = true
theme = "system"                    # "light" | "dark" | "system"
show_menubar_icon = true

[hotkey]
trigger = "Cmd+Shift+K"            # Global hotkey
accept = "Tab"                      # Accept suggestion
dismiss = "Escape"                  # Dismiss overlay

[ai]
provider = "cerebras"
model = "gpt-oss-120b"
reasoning_effort = "high"           # "low" | "medium" | "high"
max_completion_tokens = 32768
timeout_seconds = 30
default_style = "casual"            # "casual" | "professional" | "concise" | "friendly"

[ui]
overlay_position = "cursor"         # "cursor" | "center" | "top-right"
show_diff = true                    # Show word-level diff
auto_dismiss_seconds = 0            # 0 = manual dismiss only
animations = true
```

---

## Rust Crates (Backend Dependencies)

| Crate               | Purpose                              |
|----------------------|--------------------------------------|
| `tauri`              | App framework (2.0)                  |
| `tauri-plugin-global-shortcut` | Global hotkey registration  |
| `tauri-plugin-clipboard-manager` | Clipboard read/write      |
| `tauri-plugin-autostart` | Launch at login                  |
| `tauri-plugin-store` | Persistent config storage            |
| `reqwest`            | HTTP client for Cerebras API         |
| `serde` / `serde_json` | Serialization                     |
| `tokio`              | Async runtime                        |
| `futures-util`       | Stream processing (SSE)              |
| `eventsource-stream` | SSE event parsing for streaming      |
| `similar`            | Text diffing (word-level)            |
| `enigo`              | Simulate keystrokes (Cmd+C/Cmd+V)    |
| `thiserror`          | Error types                          |

## Frontend Dependencies

| Package              | Purpose                              |
|----------------------|--------------------------------------|
| `react`              | UI framework                         |
| `tailwindcss`        | Styling                              |
| `framer-motion`      | Animations                           |
| `@tauri-apps/api`    | Tauri frontend bindings              |
| `diff-match-patch` or `jsdiff` | Frontend text diffing      |
| `lucide-react`       | Icons                                |
| `zustand`            | State management (lightweight)       |
| `sonner`             | Toast notifications                  |
| `cmdk`               | Command palette (settings search)    |

---

## Future Roadmap (Post-MVP)

- **Multi-provider support**: Add OpenAI, Anthropic, Groq, Ollama as alternative backends
- **Live mode**: Accessibility API-based auto-detection of typing pauses
- **Per-app profiles**: Auto-switch style based on active application
- **Writing style learning**: Analyze user's corrections over time
- **Multiple suggestions**: Show 2-3 variants to choose from
- **Custom rules**: "Never use Oxford comma", "Always capitalize product names"
- **Translation mode**: Detect language → optionally translate
- **Windows & Linux support**: Leverage Tauri cross-platform
- **Usage analytics**: Local-only dashboard (texts improved, common mistakes, etc.)
- **Snippet expansion**: Shorthand → full text (e.g., "ty" → "Thank you!")
- **Team/org config sharing**: Shared style guides
- **Stronghold integration**: Encrypted API key storage for production builds

---

## Project Structure

```
channely/
├── docs/
│   ├── SPEC.md                     # This file
│   └── ONGOING.md                  # Phase tracking & progress
├── src-tauri/                      # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/               # Tauri 2.0 permissions
│   ├── src/
│   │   ├── main.rs                 # Entry point
│   │   ├── lib.rs                  # Library root
│   │   ├── commands/               # Tauri commands (IPC)
│   │   │   ├── mod.rs
│   │   │   ├── clipboard.rs        # Clipboard operations
│   │   │   ├── ai.rs               # AI provider calls
│   │   │   └── settings.rs         # Config management
│   │   ├── ai/                     # Cerebras AI integration
│   │   │   ├── mod.rs
│   │   │   ├── cerebras.rs         # Cerebras client (streaming SSE)
│   │   │   └── types.rs            # Request/response types
│   │   ├── hotkey/                  # Global hotkey management
│   │   │   ├── mod.rs
│   │   │   └── handler.rs
│   │   ├── clipboard/              # Clipboard management
│   │   │   ├── mod.rs
│   │   │   └── manager.rs
│   │   ├── diff/                   # Text diffing
│   │   │   ├── mod.rs
│   │   │   └── engine.rs
│   │   ├── config/                 # Configuration
│   │   │   ├── mod.rs
│   │   │   └── schema.rs
│   │   └── tray/                   # System tray
│   │       ├── mod.rs
│   │       └── menu.rs
│   └── tests/                      # Rust integration tests
│       ├── ai_tests.rs
│       ├── diff_tests.rs
│       └── clipboard_tests.rs
├── src/                            # React frontend
│   ├── main.tsx                    # Entry point
│   ├── App.tsx                     # Root component
│   ├── components/
│   │   ├── overlay/                # Floating correction overlay
│   │   │   ├── Overlay.tsx
│   │   │   ├── DiffView.tsx
│   │   │   ├── ActionBar.tsx
│   │   │   └── StyleSelector.tsx
│   │   ├── settings/               # Settings window
│   │   │   ├── Settings.tsx
│   │   │   ├── GeneralTab.tsx
│   │   │   ├── AIProviderTab.tsx
│   │   │   ├── HotkeyTab.tsx
│   │   │   └── StyleTab.tsx
│   │   ├── tray/                   # Tray menu components
│   │   │   └── TrayMenu.tsx
│   │   ├── onboarding/             # First-run setup
│   │   │   └── Onboarding.tsx
│   │   └── ui/                     # Shared UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Toggle.tsx
│   │       ├── Kbd.tsx
│   │       └── GlassPanel.tsx
│   ├── hooks/                      # Custom React hooks
│   │   ├── useTauriCommand.ts
│   │   ├── useTheme.ts
│   │   └── useHotkey.ts
│   ├── stores/                     # Zustand stores
│   │   ├── overlayStore.ts
│   │   └── settingsStore.ts
│   ├── lib/                        # Utilities
│   │   ├── tauri.ts                # Tauri IPC wrappers
│   │   ├── diff.ts                 # Frontend diff utilities
│   │   └── constants.ts
│   └── styles/
│       └── globals.css             # TailwindCSS + custom styles
├── tests/                          # E2E tests
│   ├── e2e/
│   │   ├── overlay.spec.ts
│   │   ├── settings.spec.ts
│   │   └── hotkey.spec.ts
│   └── setup.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── postcss.config.js
└── README.md
```
