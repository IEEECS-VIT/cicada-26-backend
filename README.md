![ieeecs-template-header](https://github.com/user-attachments/assets/c3c40c85-51a2-4a5e-82a4-c32a0223e336)

<h1 align="center">Cicada '26 Backend System</h1>

<h4 align="center">Enterprise Express and TypeScript Service Architecture for Live Leaderboard and Challenge Engine Operations.</h4>

---

## Overview

The **Cicada '26 Backend** is a production-ready application server designed to manage competitive telemetry, live leaderboard rankings, and challenge progression during the Cicada '26 event.

### Key Capabilities

- **Live Leaderboard Service**: Dynamic calculation and real-time rank determination based on:
  1. **Challenges Completed** (Descending order)
  2. **Completion Time** (Ascending order)
- **Repository Architecture**: Implements an isolated repository pattern (`ILeaderboardRepository` and `IChallengeRepository`). All database access is encapsulated within `src/database/supabase/`, allowing clean database engine migrations without impacting core business logic or controller handlers.
- **Challenge and Story Engine**: Manages challenge sequencing, story fragment progression, multi-format media asset payloads (Images, PDFs, Audio, Video, Files, Text), case-insensitive response verification, and progress tracking.
- **Real-Time Data Streaming**: Provides Server-Sent Events (SSE) via `/api/leaderboard/stream` to push updates instantly to connected clients and administrative consoles.
- **Access Control & Administration**: Implements key-based authentication (`x-admin-key`) for administrative operations including manual score overrides, delta adjustments, and challenge configuration.

---

## Technical Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime Engine** | Node.js (v24+) | Server-side JavaScript runtime environment |
| **Web Framework** | Express.js (v4.21) | Application routing and HTTP middleware pipeline |
| **Language** | TypeScript (v5.8) | Strongly-typed compilation target |
| **Data Layer** | Repository Pattern | Decoupled persistence interface architecture |
| **Database Platform** | Supabase (PostgreSQL) | Persistence layer with RLS, triggers, and views |
| **Validation** | Zod (v3.24) | Runtime request schema parsing |

---

## Repository Structure

```
Cicada-26-Backend/
├── bruno/                                           # API Testing Collection
├── database/
│   └── supabase/
│       └── supabase_setup.sql                       # Database schema and setup migration script
├── src/
│   ├── database/                                    # Database abstraction layer
│   │   ├── interfaces/                              # Repository interfaces
│   │   │   ├── challengeRepository.ts
│   │   │   └── leaderboardRepository.ts
│   │   └── supabase/                               # Supabase implementation adapters
│   │       ├── supabaseChallengeRepository.ts
│   │       ├── supabaseClient.ts
│   │       └── supabaseLeaderboardRepository.ts
│   ├── config/                                      # Application configuration
│   ├── controllers/                                 # Request handling and schema validation
│   ├── middleware/                                  # Authentication and authorization middleware
│   ├── routes/                                      # Express route handlers
│   ├── services/                                    # Business logic workflows
│   ├── types/                                       # Domain entity and DTO definitions
│   ├── app.ts                                       # Express application configuration
│   └── server.ts                                    # Application startup entry point
├── API_ROUTES.md                                    # Comprehensive API reference documentation
├── CODE_OF_CONDUCT.md                               # Project code of conduct
├── CONTRIBUTING.md                                  # Contribution guidelines
├── package.json                                     # Package dependencies and operational scripts
└── tsconfig.json                                    # TypeScript compiler configuration
```

---

## Setup and Configuration

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd Cicada-26-Backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory following the structure defined in `.env.example`:

```env
# Server Environment
PORT=5000
NODE_ENV=development

# Supabase Credentials
SUPABASE_URL=https://fdzcrmwwjpfwntbakied.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Administration Security Secret
ADMIN_API_KEY=your_admin_secret_key_here
```

### 3. Database Migration

Execute the script [`database/supabase/supabase_setup.sql`](file:///c:/Users/SHIKHAR%20PANDEY/Desktop/Cicada-26-Backend/database/supabase/supabase_setup.sql) in your Supabase SQL Console. This script provisions:
- `public.leaderboard` table and `public.live_leaderboard` ranking view
- `public.challenges` table with story fragment support
- `public.team_progress` tracking table
- Row Level Security (RLS) policies and update triggers

---

## Execution Instructions

### Development Server
Run the local development server with automatic file watching:
```bash
npm run dev
```

### Production Build and Execution
Compile TypeScript source files and start the production server:
```bash
npm run build
npm start
```

---

## Compliance and Licensing

This repository complies with organizational engineering guidelines and governance standards. Refer to `CONTRIBUTING.md` and `LICENSE` for details.
