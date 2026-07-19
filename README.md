![ieeecs-template-header](https://github.com/user-attachments/assets/c3c40c85-51a2-4a5e-82a4-c32a0223e336)

<h1 align="center">Cicada '26 Backend - Live Leaderboard API</h1>

<h4 align="center">High-performance Express + TypeScript API featuring a modular database repository architecture with Supabase integration.</h4>

---

## 📌 Overview

The **Cicada '26 Backend** provides a robust, real-time Live Leaderboard service for managing team rankings during the **Cicada '26** competition.

### Core Features:
- 🏆 **Live Leaderboard**: Automatic real-time team ranking based on contest rules:
  1. **Challenges Solved** (`DESC` - Highest completed count wins)
  2. **Completion Time** (`ASC` - Earliest completion / lowest time taken breaks ties)
- 🧩 **Modular Database Architecture**: Fully decoupled Repository Pattern (`ILeaderboardRepository`). All Supabase code is completely isolated inside `src/database/supabase/`. If you ever migrate away from Supabase to raw PostgreSQL, Prisma, Drizzle, or MongoDB, you can simply swap out the repository implementation without touching your business logic or controllers!
- ⚡ **Supabase Integration**: Isolated database adapter with PostgreSQL views, triggers, and Row Level Security (RLS).
- 📡 **Realtime Streaming (SSE)**: Built-in Server-Sent Events (SSE) `/api/leaderboard/stream` endpoint for sub-second live updates to clients & admin dashboards.
- 🔐 **Admin Management**: Secure admin endpoints (`x-admin-key` header) to manually override team scores, adjust points with delta increments, update entries, or delete teams.
- 🧪 **API Testing Ready**: Comes pre-configured with Bruno collections and Postman collection files for instant API testing.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology Used | Description |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js (v24+) | High performance JavaScript runtime |
| **Framework** | Express.js | Lightweight web application framework |
| **Language** | TypeScript (v5.8) | Type-safe code with strict mode |
| **Database Architecture** | Repository Pattern | Decoupled DB abstraction layer (`ILeaderboardRepository`) |
| **Database Provider** | Supabase (PostgreSQL) | Isolated in `src/database/supabase/` |
| **Validation** | Zod (v3.24) | Strict runtime schema validation for request payloads |
| **API Client Tool** | Bruno & Postman | Collection files included in repository |

---

## 📁 Project Structure

```bash
Cicada-26-Backend/
├── bruno/                                           # Bruno API Collection
├── database/
│   └── supabase/
│       └── supabase_setup.sql                       # Supabase SQL database migration script
├── src/
│   ├── database/                                    # Isolated Database Abstraction Layer
│   │   ├── interfaces/
│   │   │   └── leaderboardRepository.ts            # Abstract DB repository interface
│   │   └── supabase/                               # Supabase Provider Module
│   │       ├── supabaseClient.ts                    # Supabase SDK client setup
│   │       └── supabaseLeaderboardRepository.ts     # Supabase DB queries & CDC subscriptions
│   ├── config/
│   │   └── supabase.ts                              # Re-exports Supabase client
│   ├── controllers/
│   │   └── leaderboardController.ts                 # Request handlers & Zod validation
│   ├── middleware/
│   │   └── authMiddleware.ts                        # Admin x-admin-key authentication
│   ├── routes/
│   │   └── leaderboardRoutes.ts                     # API routes definition
│   ├── services/
│   │   └── leaderboardService.ts                    # Business logic (uses repository interface)
│   ├── types/
│   │   └── leaderboard.ts                           # TypeScript interfaces & DTOs
│   ├── app.ts                                       # Express app configuration
│   └── server.ts                                    # Server entry point
├── .env.example                                     # Environment variables template
├── API_ROUTES.md                                    # Comprehensive API routes documentation
├── Cicada_26_Leaderboard.postman_collection.json    # Postman/Bruno collection
├── package.json                                     # Scripts and dependencies
└── tsconfig.json                                    # TypeScript compiler configuration
```

---

## ⚙️ Setup Instructions

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd Cicada-26-Backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Supabase Credentials (from Supabase Dashboard -> Project Settings -> API Keys)
SUPABASE_URL=https://fdzcrmwwjpfwntbakied.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Admin Authentication Secret
ADMIN_API_KEY=sb_secret_PDPDEMJYJko0s5Bg7fP_GQ_hO5TgW09
```

### 3. Run Supabase Database Migration

1. Open your Supabase Dashboard: [https://supabase.com/dashboard/project/fdzcrmwwjpfwntbakied](https://supabase.com/dashboard/project/fdzcrmwwjpfwntbakied)
2. Go to **SQL Editor** (`>_`).
3. Copy the contents of [`database/supabase/supabase_setup.sql`](file:///c:/Users/SHIKHAR%20PANDEY/Desktop/Cicada-26-Backend/database/supabase/supabase_setup.sql) and click **Run**.

---

## 🚀 Running the Project

### Development Mode (with hot-reload)
```bash
npm run dev
```

### Build & Run Production Server
```bash
npm run build
npm start
```

---

## 🟢 Project Status

- 🟢 **Completed & Operational**
