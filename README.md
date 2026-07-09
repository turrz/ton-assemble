# TonAssemble

[![CI](https://github.com/turrz/ton-assemble/actions/workflows/ci.yml/badge.svg)](https://github.com/turrz/ton-assemble/actions/workflows/ci.yml)

TonAssemble is a full-stack Telegram Mini App for creating and publishing simple websites for `.ton` domains.

It demonstrates a production-style TypeScript monorepo with a Fastify API, Telegram bot, React Mini App, SQLite persistence, TON Connect wallet linking, on-chain `.ton` ownership checks, and TON DNS publish flows.

## Features

- Telegram Mini App built with React, Vite, and TON Connect UI
- Telegram bot entry point with app, preview, and admin access-key commands
- TON wallet linking through Telegram Web App init data
- `.ton` domain ownership verification on mainnet
- Static site creation from validated templates
- Site preview and public slug routes
- Publish flow for TON DNS site records
- Optional TON Storage or ADNL reverse-proxy publishing mode
- SQLite data layer with automatic startup migrations

## Screenshots

The flow below follows the main user journey from onboarding to publish.

<p align="center">
  <img src="assets/screenshots/main-page-1.png" width="330" alt="TonAssemble home screen with onboarding steps">
  <img src="assets/screenshots/ton-connect.png" width="330" alt="TON Connect wallet authorization dialog">
</p>
<p align="center"><em>Start from the onboarding home screen, then authorize your TON wallet with TON Connect.</em></p>

<p align="center">
  <img src="assets/screenshots/domains-page.png" width="330" alt="Domains page with verified .ton domains">
  <img src="assets/screenshots/create-site-1.png" width="330" alt="Create site form with domain and template selection">
</p>
<p align="center"><em>Verify `.ton` domain ownership on-chain, then pick a domain, template, and optional preview slug.</em></p>

<p align="center">
  <img src="assets/screenshots/create-site-4.png" width="330" alt="Create site form with features and preview action">
  <img src="assets/screenshots/preview-page-1.png" width="330" alt="Site preview with publish action">
</p>
<p align="center"><em>Add content and features, then preview the rendered site and confirm everything before publishing.</em></p>

<p align="center">
  <img src="assets/screenshots/connect-to-proxy.png" width="330" alt="Publish flow with wallet signing QR code">
  <img src="assets/screenshots/preview-page-2.png" width="330" alt="Published site preview with feature sections">
</p>
<p align="center"><em>Sign the DNS transaction in your wallet to go live, then browse the finished site on your domain.</em></p>

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20
- **API:** Fastify
- **Bot:** Telegraf
- **Web:** React, Vite, Tailwind CSS
- **Validation:** Zod
- **Database:** SQLite, better-sqlite3
- **TON:** `@ton/core`, `@ton/ton`, TON Connect
- **Monorepo:** npm workspaces (pnpm-compatible scripts)
- **Deployment:** Docker, docker-compose

## Architecture

TonAssemble is organized as a small monorepo:

- The Telegram bot opens the Mini App and provides helper commands.
- The web app uses Telegram init data to authenticate API requests.
- The API verifies Telegram init data, stores users, domains, and sites, renders templates, and prepares TON DNS transactions.
- Shared packages isolate database access, TON client logic, DNS operations, storage integration, and template rendering.

The API serves both JSON endpoints and the built Mini App and static site pages from the same origin.

## Project Structure

```text
apps/
  api/      Fastify API, public routes, services, auth middleware
  bot/      Telegram bot
  web/      React Telegram Mini App

packages/
  blockchain/  TON client helpers
  db/          SQLite access layer
  dns/         .ton ownership and DNS transaction logic
  storage/     TON Storage integration
  templates/   Static website templates
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm (recommended) or pnpm
- Telegram bot token from [BotFather](https://t.me/BotFather)
- TON mainnet RPC endpoint

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
```

Fill in the required values before starting the services:

- `BOT_TOKEN`
- `PUBLIC_BASE_URL`
- `TON_RPC_URL`
- either `TON_PROXY_ADNL_HEX` or all `TON_STORAGE_*` variables

Set `VITE_API_URL` in `apps/web/.env` to the same public origin as `PUBLIC_BASE_URL`.

### Build

Build shared packages and apps in dependency order:

```bash
npm run build --workspace=@ton-site-builder/db
npm run build --workspace=@ton-site-builder/blockchain
npm run build --workspace=@ton-site-builder/dns
npm run build --workspace=@ton-site-builder/storage
npm run build --workspace=@ton-site-builder/templates
npm run build --workspace=@ton-site-builder/api
npm run build --workspace=@ton-site-builder/bot
npm run build --workspace=@ton-site-builder/web
cp -r apps/web/dist/* apps/api/public/
```

### Run locally

Start the API and bot:

```bash
npm run dev --workspace=@ton-site-builder/api
npm run dev --workspace=@ton-site-builder/bot
```

Run the web app during frontend development:

```bash
cd apps/web
npm run dev
```

Telegram Mini Apps require HTTPS in production. For local end-to-end Telegram testing, use a secure tunnel and set `PUBLIC_BASE_URL` and `VITE_API_URL` to the public HTTPS URL.

### Docker

With `.env` configured, build and start both services:

```bash
docker compose up --build
```

The API is exposed on the port defined by `PORT` (default `3000`). SQLite data is persisted in `./data`.

## Environment Variables

Root `.env`:

```env
BOT_TOKEN=your_telegram_bot_token
PUBLIC_BASE_URL=https://your-public-app-url
WEBAPP_PATH=
ADMIN_TELEGRAM_ID=
DB_PATH=./data/tonassemble.sqlite
PORT=3000

TON_RPC_URL=https://mainnet-v4.tonhubapi.com
TON_NETWORK=mainnet

# Publishing mode A: ADNL reverse proxy
TON_PROXY_ADNL_HEX=

# Publishing mode B: TON Storage
TON_STORAGE_DAEMON_BIN=
TON_STORAGE_DAEMON_HOST=
TON_STORAGE_DB_PATH=

# Optional support links
DONATE_TON_ADDRESS=
DONATE_TEXT=
CONTACT_TELEGRAM=
CONTACT_X=
CONTACT_EMAIL=
```

Web app `.env`:

```env
VITE_API_URL=https://your-public-app-url
VITE_TON_NETWORK=mainnet
```

## License

MIT
