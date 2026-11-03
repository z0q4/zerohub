# ZeroHub

A modern, minimal hub for managing projects and resources with zero complexity.

## Features

- **Lightweight & Fast:** Built for high performance with minimal overhead.
- **Easy Setup:** Quick to install, configure, and run.
- **Minimal Dependencies:** Clean dependency tree for better security and maintainability.
- **Intuitive UI:** Clean, distraction-free interface.
- **Modular Architecture:** Easily extensible to fit your workflow.

---

## Installation

### Windows

Open **PowerShell as Administrator** and run the following steps:

```powershell
# 1. Install Git and Node.js LTS via winget
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

> **Note:** Restart your PowerShell terminal after installing Git and Node.js so the environment variables (`PATH`) are updated.

```powershell
# 2. Clone the repository into your Documents folder
cd "$HOME\Documents"
git clone [https://github.com/z0q4/zerohub.git](https://github.com/z0q4/zerohub.git)
cd zerohub

# 3. Install dependencies and start the application
npm install
npm start
```

---

### Linux (Debian / Ubuntu)

```bash
# 1. Update packages and install required system/Electron dependencies
sudo apt update && sudo apt install -y \
  git curl build-essential libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2

# 2. Install NVM (Node Version Manager) and Node.js v22
curl -o- [https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh](https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh) | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 3. Clone the repository
mkdir -p ~/Documents && cd ~/Documents
git clone [https://github.com/z0q4/zerohub.git](https://github.com/z0q4/zerohub.git)
cd zerohub

# 4. Install dependencies and start the application
npm install
npm start
```

---

## Quick Usage (Development)

If you already have the repository cloned and your environment configured:

```bash
# Ensure you are using Node.js v22 (if using NVM)
nvm use 22

# Install dependencies
npm install

# Run the application via Forge/Vite
npm start

# Or launch Electron directly from the root directory
npx electron .
```

---

## Documentation

For detailed documentation, please refer to the [docs](./docs) directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, bug reports, and questions, please open an issue on [GitHub Issues](https://github.com/z0q4/zerohub/issues).
