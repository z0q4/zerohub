<div align="center">

# ZeroHub

**A Modular Desktop Workspace for Geospatial Intelligence (GEOINT) & Tactical OSINT Reconnaissance**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=flat-square&logo=electron&logoColor=9FEAF9)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-success.svg?style=flat-square)](./LICENSE)

</div>

---

## Overview

**ZeroHub** is a high-performance desktop intelligence workbench designed to unify digital reconnaissance and spatial analysis. Built on a hybrid **Electron + TypeScript** frontend with **Python-driven** intelligence modules, it provides analysts, researchers, and security professionals with a distraction-free, tactical HUD for mapping network infrastructure, correlating IP geolocation data, and managing multi-layered OSINT workflows.

## Key Capabilities

* **Geospatial Intelligence (GEOINT) Workspace:** Interactive 2D/3D globe and multi-provider map engine with monochrome and tactical visual profiles.
* **Hierarchical IP Geolocation:** Automated spatial resolution, infrastructure mapping, and network telemetry correlation.
* **Modular Intelligence Layers:** Toggleable data overlays designed to isolate, filter, and cross-reference targets on the fly.
* **Tactical HUD Interface:** Low-latency, high-contrast user interface engineered for operational focus and rapid data inspection.
* **Hybrid Execution Engine:** Combines the responsiveness of a Vite-bundled TypeScript renderer with the analytical power of Python backend scripts.

---

## Tech Stack & Architecture

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Core / Shell** | Electron & Electron Forge | Cross-platform desktop runtime, IPC security, and native packaging |
| **Frontend / HUD** | TypeScript, HTML5, CSS3 | Tactical UI, state management, and spatial viewport rendering |
| **Bundler** | Vite | Fast HMR and optimized builds for `main`, `preload`, and `renderer` processes |
| **Intelligence Modules** | Python 3 | Data parsing, OSINT automation, and external API integrations |

---

## Getting Started

### Prerequisites

* **Git**
* **Node.js** (v22 LTS recommended)
* **Python 3.10+** (for auxiliary intelligence modules)

### Windows Installation

Open **PowerShell as Administrator** and install the core dependencies:

```powershell
# 1. Install Git and Node.js LTS via winget
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

> **Note:** Restart your PowerShell terminal after installation so the updated `PATH` variables take effect.

```powershell
# 2. Clone the repository
cd "$HOME\Documents"
git clone [https://github.com/z0q4/zerohub.git](https://github.com/z0q4/zerohub.git)
cd zerohub

# 3. Install Node dependencies (and Python dev requirements if applicable)
npm install
pip install -r requirements.txt

# 4. Launch the workspace
npm start
```

### Linux Installation (Debian / Ubuntu)

```bash
# 1. Install system and Electron graphical dependencies
sudo apt update && sudo apt install -y \
  git curl build-essential python3 python3-pip python3-venv \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2

# 2. Install NVM and Node.js v22
curl -o- [https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh](https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh) | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 3. Clone the repository
mkdir -p ~/Documents && cd ~/Documents
git clone [https://github.com/z0q4/zerohub.git](https://github.com/z0q4/zerohub.git)
cd zerohub

# 4. Install dependencies and launch
npm install
pip3 install -r requirements.txt
npm start
```

---

## Development & Quick Usage

If your environment is already configured, use the standard development scripts from the project root:

```bash
# Switch to the required Node version
nvm use 22

# Install or update packages
npm install

# Start the Electron Forge development server with HMR
npm start

# Run linter and test suites
npm run lint
npm test
```

---

## Documentation

For deeper architectural insights, module specifications, and API references, check the [`/docs`](./docs) directory.

## Contributing

Contributions, bug reports, and feature requests are welcome.
1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/new-intel-layer`).
3. Commit your changes following Conventional Commits (`git commit -m "feat: add newlayer"`).
4. Push to the branch and open a Pull Request.

## License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full details.

## Support & Security

For bug reports, feature requests, or architectural discussions, please open an issue on [GitHub Issues](https://github.com/z0q4/zerohub/issues).
