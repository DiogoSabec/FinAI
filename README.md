<div align="center">

# FinAI

**Personal finance dashboard with an optional AI advisor — your money, your machine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-sql.js-003B57?logo=sqlite&logoColor=white)](https://sql.js.org)
[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)](https://www.electronjs.org)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=googlegemini&logoColor=white)](https://aistudio.google.com)

</div>

---

## Overview

FinAI is a local-first personal finance app: a React + Vite frontend, an Express + SQLite backend, and an optional Google Gemini chat that understands your data. Track accounts, income, expenses, subscriptions and budget goals — without ever sending a transaction to a third-party server.

It runs in the browser **and** ships as a desktop app via Electron.

## Screenshots

> _Coming soon — drop images in `docs/screenshots/` and update the paths below._

| Dashboard | AI Advisor | CSV Import |
| :---: | :---: | :---: |
| ![Dashboard](docs/screenshots/dashboard.png) | ![AI Advisor](docs/screenshots/ai-advisor.png) | ![CSV Import](docs/screenshots/csv-import.png) |

## Features

- **Dashboard** — monthly overview with filtering
- **Accounts** — multiple accounts with transfers between them
- **Income / Expenses / Subscriptions** — month + search filtering, batch edit
- **Budget Goals** — set monthly targets per category
- **CSV Import** — bulk import bank or credit-card statements (income + expenses) with AI-assisted category suggestions
- **AI Advisor** — context-aware chat (Google Gemini) with Markdown rendering and history
- **Backup & restore** — export/import the full SQLite database; reset on demand
- **Themes** — light & dark mode with persistent preference
- **Desktop app** — runs as a native app on macOS and Windows via Electron
- **Local-first** — all data stays in `server/finances.db` on your machine

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, custom design system |
| Backend | Node.js, Express, centralized validation |
| Database | SQLite via [`sql.js`](https://sql.js.org) |
| AI | Google Gemini API (optional) |
| Desktop | Electron 42 + electron-builder |

## Getting Started

### Prerequisites

- Node.js **20+** (tested on `v24.14.1`)
- npm **10+** (tested on `11.11.0`)

### Install

```bash
git clone https://github.com/DiogoSabec/FinAI.git
cd FinAI
npm run install:all
```

### Configure

Create a `.env` file in the project root:

```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here
```

- `PORT` is optional (defaults to `3001`).
- `GEMINI_API_KEY` is optional — the app runs without it, but the AI Advisor will be disabled. Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Run (web)

```bash
npm run dev
```

- API: http://localhost:3001
- UI:  http://localhost:5173

### Run (desktop)

```bash
npm run electron:dev
```

### Build a desktop installer

```bash
npm run dist:mac   # macOS .dmg (arm64 + x64)
npm run dist:win   # Windows NSIS installer
npm run dist:all   # both
```

Output goes to `release/`.

## Available Screens

Dashboard · Accounts · Income · Expenses · Subscriptions · CSV Import · Budget Goals · AI Advisor · Settings

## Project Structure

```text
.
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/   # Dashboard, Accounts, Expenses, Income, …
│       ├── hooks/        # useCurrency, useTheme
│       └── utils/        # api, categories, csvBank, themes
├── server/          # Express API + SQLite setup
│   └── routes/      # accounts, expenses, income, goals, subscriptions
├── electron/        # Electron main process
├── package.json     # root scripts
└── .env             # local environment variables
```

## Local Data Storage

- Database file: `server/finances.db` (created on first run)
- Backup / restore from **Settings → Backup**
- Reset the database from **Settings → Reset**

## Useful URLs

- App UI: http://localhost:5173
- API health: http://localhost:3001/api/health

## Troubleshooting

<details>
<summary><strong>Port already in use</strong></summary>

Change the backend port via `PORT` in `.env`, or the frontend port in `client/vite.config.js`. If you change the frontend port, also update the allowed origins in `server/index.js` (currently `http://localhost:5173` and `http://localhost:5174`).
</details>

<details>
<summary><strong>AI Advisor says the API key is missing</strong></summary>

Make sure your root `.env` contains `GEMINI_API_KEY=...` and restart the backend.
</details>

<details>
<summary><strong>Frontend loads but API calls fail</strong></summary>

Confirm the backend is running:

```bash
curl -sS http://localhost:3001/api/health
# {"status":"ok","timestamp":"..."}
```
</details>

<details>
<summary><strong>Fresh install issues</strong></summary>

```bash
npm run install:all
```
</details>

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change. Bug reports and feature requests have templates under `.github/ISSUE_TEMPLATE/`.

## License

[MIT](LICENSE) © Diogo Sabec
