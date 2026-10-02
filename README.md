# ⚡ E-FORCE 24H MINING - Telegram Mini App & Bot

A production-grade **Telegram Mini App** built with **React + TypeScript (Vite)** on the frontend and **Node.js (Fastify)** + **PostgreSQL** + **Redis** + **grammY** bot on the backend. Designed with an ultra-sleek **White & Orange Cyber Aesthetic** and interactive 3D media assets.

---

## 🚀 Key Features

- **24-Hour Mining Engine**: Limited Genesis mining pool protocol with countdown timer, real-time accumulation yield, and claim & restart cycles.
- **3D Interactive Reactor Core**: Central glowing energy Katana blade 3D video (`.mp4`) with live speed aura and dynamic pulse ring.
- **Standard & Special Tasks**:
  - **Standard Tasks**: Channel subscriptions, website actions, and community engagement.
  - **🔥 Special Tasks**: High-yield boosters with sponsored video ad simulations and massive speed boosts.
- **Referral Tracking System**:
  - Deep-link referral generator (`ref_<userId>`).
  - Automatic DM notifications to referrers when a friend joins.
  - Permanent Mining Speed Boost (`+0.05 E-FORCE/hr`) & Instant bonus for every friend.
- **Leaderboard**: Top 50 global miners with podium standings and user rank tracker.
- **Comprehensive Admin Panel**:
  - Live KPI stats (Total users, active miners, total mined tokens, completed tasks).
  - Task Manager: Create, edit, toggle, and delete standard and special tasks.
  - Bot Broadcast: 1-click broadcast to all Telegram users with optional images.
  - User Inspector: Search users, adjust speeds, and ban/unban bad actors.
- **Multi-Engine Database & Cache**:
  - Primary: **PostgreSQL** (production) via `pg` connection pool with automatic schema setup.
  - Embedded Fallback: Native Node.js SQLite (`node:sqlite`) for zero-friction local development without installing PostgreSQL.
  - Primary: **Redis** via `ioredis` for leaderboard, caching, and rate limiting, with in-memory fallback.

---

## 🛠️ Tech Stack

- **Frontend**: React 18 / 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Canvas Confetti.
- **Telegram SDK**: `@telegram-apps/sdk-react` & Official Telegram WebApp script.
- **Backend**: Node.js 20+ (Fastify, `@fastify/cors`, `@fastify/static`).
- **Bot Engine**: `grammY` (modern high-speed Telegram bot framework).
- **Database**: PostgreSQL (`pg`) + SQLite fallback (`node:sqlite`).
- **Cache/Leaderboard**: Redis (`ioredis`) + In-Memory fallback.

---

## 📦 How to Run Locally

### 1. Clone & Install Dependencies
```bash
# Install root backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your credentials:
- `BOT_TOKEN`: From [@BotFather](https://t.me/BotFather)
- `ADMIN_IDS`: Your Telegram numeric ID (comma-separated). Note: `999888777` is included for instant admin access during local browser preview!

### 3. Build & Run
To run both backend and frontend together:
```bash
npm run dev
```

Or run the production server (serves both API and Web App on `http://localhost:3000`):
```bash
# Build frontend
npm run build

# Start server
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🤖 Telegram Bot & WebApp Setup (@BotFather)

1. Open [@BotFather](https://t.me/BotFather) on Telegram.
2. Create your bot with `/newbot` and copy your token into `BOT_TOKEN` in `.env`.
3. Create the Mini App with `/newapp`:
   - Select your bot.
   - Choose a title and description.
   - Set **Web App URL** to your HTTPS URL (e.g. from Render, Railway, Cloudflare Pages, or ngrok).
   - Choose a short name (e.g. `app`).
4. Set Menu Button:
   - `/setmenubutton` -> Select your bot -> Enter Web App URL.

---

## 🌐 Deploy to Production

- **Frontend**: Can be served by Fastify directly, or deployed separately to **Vercel** / **Cloudflare Pages**.
- **Backend & Database**: One-click deploy to **Render**, **Railway**, or any **VPS** with `DATABASE_URL` (PostgreSQL) and `REDIS_URL`.
