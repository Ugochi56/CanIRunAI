# CanIRunAI

> Ever wondered if you can run LLaMA 3 or Mixtral locally? CanIRunAI checks your VRAM, RAM, and compute power to tell you exactly what fits.

**CanIRunAI** is a local-first web app that auto-detects your hardware and instantly shows which AI models — LLMs, image generators, and video generators — your machine can actually run. Think of it as **"Can You Run It?" but for AI models.**

<p align="center">
  <img src="public/logo.png" alt="CanIRunAI Logo" width="120" />
</p>

<p align="center">
  <em>Match your specs to the perfect LLM.</em>
</p>

---

## ✨ Features

- **🔍 Auto-Detect Hardware** — Instantly scans your CPU, GPU, VRAM, and system RAM on startup
- **🧠 60+ Model Database** — Covers LLMs (Llama, Qwen, Mistral, DeepSeek, Gemma, Phi), image gen (Stable Diffusion, FLUX, PixArt), and video gen (CogVideoX, Wan, HunyuanVideo, Mochi)
- **✅ Compatibility Verdicts** — Every model gets a clear **Can Run / Tight Fit / Too Heavy** rating based on your actual hardware
- **⬇️ One-Click Pull** — Pull Ollama models directly from the UI with real-time streaming progress bars
- **🍎 Apple Silicon Aware** — Detects unified memory on M1/M2/M3/M4 Macs and calculates effective VRAM allocation
- **🖥️ CPU-Only Models** — Highlights models that run without a GPU at all (stable-diffusion.cpp, LCM, OpenVINO)
- **🔎 Search & Filter** — Filter by compatibility, category (Chat, Code, Vision, Video, Image, CPU-Only), or search by name
- **🚀 Fast** — Hardware info is cached at startup; page loads are near-instant after first boot

## 📸 How It Works

1. **Start the server** — your hardware is scanned once and cached
2. **Open the UI** — see your CPU, GPU, RAM, and OS at a glance
3. **Browse the model library** — every model shows exactly how much RAM/VRAM it needs vs. what you have
4. **Pull models** — if Ollama is running, pull LLMs directly with streaming download progress
5. **No Ollama? No problem** — the compatibility checker works regardless; Ollama is only needed for pulling models

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/download) *(optional — only needed to pull/run LLM models)*

### Install & Run

```bash
git clone https://github.com/Ugochi56/CanIRunAI.git
cd CanIRunAI
npm install
npm run dev
```

Open **http://localhost:3456** in your browser.

### That's it. No build step, no bundler, no config files.

## 🗂 Project Structure

```
CanIRunAI/
├── server.js          # Express server — hardware detection, Ollama proxy, SSE streaming
├── public/
│   ├── index.html     # Single-page app — full UI, model database, compatibility engine
│   └── logo.png       # App logo/favicon
├── package.json
└── .gitignore
```

## 🧠 Model Categories

| Category | Examples | What's Checked |
|----------|----------|----------------|
| 💬 **Chat** | Llama 3.1, Qwen 2.5, Mistral, Gemma 2 | System RAM |
| 💻 **Code** | CodeLlama, StarCoder2, Qwen2.5-Coder | System RAM |
| 🧩 **Reasoning** | DeepSeek R1, Phi-3/4 | System RAM |
| 👁 **Vision** | LLaVA, Llama 3.2 Vision | System RAM |
| 🔤 **Embedding** | Nomic, MxBai, all-MiniLM | System RAM |
| 🎨 **Image Gen** | FLUX, SDXL, SD 1.5, PixArt, Playground | GPU VRAM |
| 🎬 **Video Gen** | CogVideoX, HunyuanVideo, Wan 2.1, Mochi | GPU VRAM |
| 🖥 **CPU-Only** | stable-diffusion.cpp, LCM, OpenVINO | RAM only (no GPU) |

## 🔧 Tech Stack

- **Backend:** Node.js + Express
- **Hardware Detection:** [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- **LLM Runtime:** [Ollama](https://ollama.com/) (optional integration)
- **Frontend:** Vanilla HTML/CSS/JS — no framework, no build step
- **Fonts:** Inter + JetBrains Mono via Google Fonts

## 🤝 Contributing

Contributions are welcome! Some ideas:

- **Add more models** — expand the `MODEL_DB` array in `index.html`
- **Improve compatibility logic** — refine RAM/VRAM thresholds
- **Linux GPU detection** — test and improve AMD ROCm / Intel Arc detection
- **Docker support** — containerize for easy deployment

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  Built for the local AI community 🤖
</p>
