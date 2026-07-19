![ieeecs-template-header](https://github.com/user-attachments/assets/c3c40c85-51a2-4a5e-82a4-c32a0223e336)

<h1 align="center">Cicada '26 Backend - Live Leaderboard API</h1>

<h4 align="center">High-performance Express + TypeScript API powered by Supabase for real-time live leaderboard management.</h4>

---

## 📌 Overview

The **Cicada '26 Backend** provides a robust, real-time Live Leaderboard service for managing team rankings during the **Cicada '26** competition.

### Core Features:
- 🏆 **Live Leaderboard**: Automatic real-time team ranking based on contest rules:
  1. **Challenges Solved** (`DESC` - Highest completed count wins)
  2. **Completion Time** (`ASC` - Earliest completion / lowest time taken breaks ties)
- ⚡ **Supabase Integration**: Native connection using `@supabase/supabase-js` with PostgreSQL database views, triggers, and Row Level Security (RLS).
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
| **Database** | Supabase (PostgreSQL) | Managed database with SQL View & Realtime CDC |
| **Database Client** | `@supabase/supabase-js` | Official Supabase TypeScript client |
| **Validation** | Zod (v3.24) | Strict runtime schema validation for request payloads |
| **API Client Tool** | Bruno & Postman | Collection files included in repository |

---

## 📁 Project Structure

```bash
Cicada-26-Backend/
├── bruno/                                    # Bruno API Collection
│   ├── bruno.json
│   ├── Set Any Score (by Team Name).bru
│   ├── Adjust Score Delta (Add or Subtract).bru
│   ├── Update Team Details (by ID).bru
│   ├── Delete Team.bru
│   ├── Get Live Leaderboard.bru
│   └── Live Stream SSE.bru
├── src/
│   ├── config/
│   │   └── supabase.ts                       # Supabase client initialization
│   ├── controllers/
│   │   └── leaderboardController.ts          # Request handlers & Zod validation
│   ├── middleware/
│   │   └── authMiddleware.ts                 # Admin x-admin-key authentication
│   ├── routes/
│   │   └── leaderboardRoutes.ts              # API routes definition
│   ├── services/
│   │   └── leaderboardService.ts             # Database operations & SSE broadcasting
│   ├── types/
│   │   └── leaderboard.ts                    # TypeScript interfaces & DTOs
│   ├── app.ts                                # Express app configuration
│   └── server.ts                             # Server entry point
├── .env.example                              # Environment variables template
├── API_ROUTES.md                             # Comprehensive API routes documentation
├── Cicada_26_Leaderboard.postman_collection.json # Postman/Bruno collection
├── package.json                              # Scripts and dependencies
├── supabase_setup.sql                        # SQL setup script for Supabase
└── tsconfig.json                             # TypeScript compiler configuration
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
3. Copy the contents of [`supabase_setup.sql`](file:///c:/Users/SHIKHAR%20PANDEY/Desktop/Cicada-26-Backend/supabase_setup.sql) and click **Run**.

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

## 📡 API Endpoints Overview

Detailed API documentation, request body examples, and headers are in [API_ROUTES.md](file:///c:/Users/SHIKHAR%20PANDEY/Desktop/Cicada-26-Backend/API_ROUTES.md).

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Backend health check |
| `GET` | `/api/leaderboard` | Public | Fetch current live ordered leaderboard |
| `GET` | `/api/leaderboard/stream` | Public | Real-time Server-Sent Events (SSE) stream |
| `POST` | `/api/leaderboard/submit` | **Admin** | Set score directly for any team by `team_name` |
| `PATCH` | `/api/leaderboard/:identifier/adjust` | **Admin** | Add or subtract points (`delta`) for any team |
| `PUT` | `/api/leaderboard/:id` | **Admin** | Update team details by entry UUID |
| `DELETE` | `/api/leaderboard/:identifier` | **Admin** | Delete team entry |
| `POST` | `/api/leaderboard/reset` | **Admin** | Reset entire leaderboard |

---

## 🧪 Testing with Bruno or Postman

- **Bruno**: Click **Open Collection** in Bruno and select the `bruno` folder inside this repository.
- **Postman**: Import `Cicada_26_Leaderboard.postman_collection.json`.

---

## 🟢 Project Status

- 🟢 **Completed & Operational**
