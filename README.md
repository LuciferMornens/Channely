# Channely

**System-wide AI text proofreading for macOS.**

Select text in any app → press `⌘⇧K` → get AI-powered corrections in a floating overlay with word-level diffs → `Tab` to accept, `Esc` to dismiss.

---

## ✨ Features

- **Works everywhere** — Select text in any macOS app and trigger proofreading with a global hotkey
- **AI-powered corrections** — Uses Cerebras Inference (`gpt-oss-120b`) for fast, high-quality proofreading
- **Word-level diffs** — See exactly what changed with color-coded inline diffs (green = added, red = removed)
- **Style presets** — Choose between Casual, Professional, Concise, and Friendly writing styles
- **Beautiful overlay** — Glass morphism floating panel with smooth animations
- **System tray** — Lives in your menubar, pause/resume anytime, track improvements
- **Dark mode** — Follows your macOS system appearance automatically
- **Privacy-first** — Your API key stays on your machine, text is sent directly to Cerebras

## 📦 Installation

### Download

Download the latest `.dmg` from [Releases](https://github.com/user/channely/releases/latest).

1. Open the `.dmg` file
2. Drag **Channely** to your **Applications** folder
3. Launch Channely — it will appear in your menubar
4. Follow the onboarding flow to set up permissions and your API key

### Build from source

**Prerequisites:**
- macOS 11.0+
- [Rust](https://rustup.rs/) (1.77.2+)
- [Node.js](https://nodejs.org/) (LTS)
- [pnpm](https://pnpm.io/) (10+)

```bash
# Clone
git clone https://github.com/user/channely.git
cd channely

# Install dependencies
pnpm install

# Development
pnpm dev

# Production build
pnpm build
```

The `.app` and `.dmg` will be in `src-tauri/target/release/bundle/macos/`.

## 🔑 Setup

### 1. Cerebras API Key

Channely uses Cerebras Inference for AI proofreading. Get a free API key:

1. Sign up at [cerebras.ai](https://cerebras.ai)
2. Create an API key in your dashboard
3. Set it as an environment variable:
   ```bash
   export CEREBRAS_API_KEY="your-key-here"
   ```
   Or enter it in **Settings → Cerebras** tab after launching the app.

### 2. Accessibility Permission

Channely needs Accessibility permission to capture selected text and paste corrections:

1. Go to **System Settings → Privacy & Security → Accessibility**
2. Add and enable **Channely**

The onboarding flow will guide you through this on first launch.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧K` | Proofread selected text |
| `Tab` / `↵` | Accept correction |
| `Esc` | Dismiss overlay |
| `⌘Q` | Quit app |

## 🎨 Style Presets

| Style | Description |
|-------|-------------|
| ☕ Casual | Natural, everyday tone |
| 💼 Professional | Formal business writing |
| ✂️ Concise | Shorter, more direct |
| 💖 Friendly | Warm and approachable |

Switch styles from the overlay or the system tray menu.

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | [Tauri 2.0](https://tauri.app) |
| Frontend | React 19 + TypeScript |
| Styling | TailwindCSS 4 |
| State | Zustand |
| Animations | Framer Motion |
| AI Provider | Cerebras Inference (`gpt-oss-120b`) |
| Backend | Rust |
| Diffing | `similar` crate (word-level) |

## 📁 Project Structure

```
channely/
├── src/                    # React frontend
│   ├── components/
│   │   ├── overlay/        # Floating correction overlay
│   │   ├── settings/       # Settings window (5 tabs)
│   │   ├── onboarding/     # First-run setup flow
│   │   └── ui/             # Shared UI components
│   ├── stores/             # Zustand state management
│   └── lib/                # Utilities (diff, streaming, placement)
├── src-tauri/              # Rust backend
│   └── src/
│       ├── ai/             # Cerebras client + SSE streaming
│       ├── clipboard/      # Clipboard read/write/preserve
│       ├── commands/       # Tauri IPC commands
│       ├── config/         # JSON config persistence
│       ├── diff/           # Word-level diff engine
│       ├── hotkey/         # Global hotkey handler
│       ├── keystroke/      # Simulated Cmd+C/V keystrokes
│       ├── performance/    # Startup + memory profiling
│       ├── permissions/    # macOS Accessibility detection
│       └── tray/           # System tray menu + state
└── docs/                   # Spec + build tracker
```

## 🧪 Testing

```bash
# Frontend tests (Vitest)
pnpm test

# Rust tests
cd src-tauri && cargo test

# Linting
pnpm lint
cd src-tauri && cargo clippy -- -D warnings
```

## 📄 License

MIT © 2026 Channely
