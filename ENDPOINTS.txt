# Cicada 2067 - Complete API Endpoints Specification

This document provides a comprehensive, production-ready specification of each and every endpoint implemented across the **Cicada 2067 Backend API**.

---

## 1. System Architecture & Authentication Overview

### 1.1. Access Control Hierarchy
| Tier | Middleware Guard | Target Audience | Description |
| :--- | :--- | :--- | :--- |
| **Public** | None | Public / Ping Monitors | Public discovery, system health, and Google OAuth login entry points. |
| **Participant** | `requireAuth` | Authenticated Users | User profile, team collaboration, active challenges, and live leaderboard. |
| **Admin** | `requireAdmin` | Event Administrators | User role management, team moderation, challenge CRUD, hint/asset config, and score overrides. |
| **Super Admin** | `requireGod` | Root System Overseers | Elevation to GOD role, viewing and purging immutable audit logs. |

### 1.2. Authentication Modes
All incoming requests are evaluated by security middleware through four supported credentials:
1. **HttpOnly Cookie**: `session_token` cookie set upon login (subject to a 30-minute inactivity sliding timeout).
2. **Bearer Token**: `Authorization: Bearer <Supabase_JWT>` validated directly with Supabase Auth.
3. **Master API Keys**:
   - Admin Master Key: `x-admin-key: <ADMIN_API_KEY>` (or query parameter `admin_key`).
   - GOD Master Key: `x-god-key: <GOD_API_KEY>` (or query parameter `god_key`).
4. **Session Headers**: `x-user-email: <email>` or `x-user-id: <user_id>`.

---

## 2. API Route Summary Table

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | System status and service welcome message |
| `GET` | `/api` | Public | API route discovery directory |
| `GET` | `/health` | Public | System uptime health probe |
| `GET` | `/api/health` | Public | Database-agnostic service health probe |
| `POST` | `/api/auth/login` | Public | Authenticate via Google token or whitelisted email |
| `POST` | `/api/auth/verify-login` | Public | Verification alias for `/login` |
| `GET` | `/api/auth/me` | `requireAuth` | Fetch authenticated user profile & team snapshot |
| `POST` | `/api/auth/logout` | Public/Auth | Invalidate session token & clear cookies |
| `POST` | `/api/auth/seed-user` | `requireAdmin` | Admin-only participant email pre-whitelisting |
| `GET` | `/api/teams/me` | `requireAuth` | Fetch current user's team details, members, & invite code |
| `GET` | `/api/teams/me/members` | `requireAuth` | List current user's team members with invite code |
| `POST` | `/api/teams/create` | `requireAuth` | Create new team & generate unique 6-character invite code |
| `POST` | `/api/teams/join` | `requireAuth` | Join existing team using 6-character invite code (max 5 members) |
| `POST` | `/api/teams/update-name` | `requireAuth` | Rename team (Team Leader only) |
| `POST` | `/api/teams/leave` | `requireAuth` | Leave current team (non-leader members only) |
| `GET` | `/api/challenges` | `requireAuth` | List active challenges with sequential lock status |
| `GET` | `/api/challenges/:identifier` | `requireAuth` | Get single challenge by order number or UUID |
| `POST` | `/api/challenges/submit` | `requireAuth` | Submit answer (rate-limited, sequential unlock, score sync) |
| `GET` | `/api/challenges/progress` | `requireAuth` | Participant progression state recovery endpoint |
| `GET` | `/api/challenges/story-fragments`| `requireAuth` | Archive view: Retrieve all unlocked story fragments |
| `GET` | `/api/challenges/assets/masked` | `requireAuth` | Masked origin asset streaming proxy |
| `GET` | `/api/leaderboard` | `requireAuth` | Live ordered rankings by solved challenges & completion time |
| `GET` | `/api/admin/auth/users` | `requireAdmin` | List all registered users and roles |
| `POST` | `/api/admin/auth/approve-admin` | `requireAdmin` | Approve pending administrator account |
| `POST` | `/api/admin/auth/toggle-role` | `requireAdmin` | Toggle user role between `participant`, `admin`, `GOD` |
| `POST` | `/api/admin/auth/delete-user` | `requireAdmin` | Delete user record from database |
| `POST` | `/api/admin/auth/bulk-import-admins`| `requireAdmin`| Bulk create/update admin accounts via CSV or JSON array |
| `GET` | `/api/admin/teams/all` | `requireAdmin` | List all teams with full member rosters |
| `POST` | `/api/admin/teams/remove-member`| `requireAdmin` | Force remove user from team |
| `POST` | `/api/admin/teams/delete-team` | `requireAdmin` | Force delete team and unlink members |
| `PATCH`| `/api/admin/teams/:id/score` | `requireAdmin` | Adjust team score points directly |
| `GET` | `/api/admin/challenges/all` | `requireAdmin` | Inspect all challenges (includes answer keys & hidden hints) |
| `GET` | `/api/admin/challenges/progress`| `requireAdmin` | Matrix progress tracking across all participating teams |
| `POST` | `/api/admin/challenges` | `requireAdmin` | Create a new challenge record |
| `PUT` | `/api/admin/challenges/:id` | `requireAdmin` | Update challenge attributes |
| `DELETE`| `/api/admin/challenges/:id` | `requireAdmin` | Delete challenge record |
| `POST` | `/api/admin/challenges/override`| `requireAdmin` | Force unlock challenge progression for a team |
| `POST` | `/api/admin/challenges/reset-team`| `requireAdmin`| Reset team progress back to challenge 1 |
| `GET` | `/api/admin/challenges/submission-logs`| `requireAdmin`| Query answer submission audit logs |
| `POST` | `/api/admin/challenges/:id/hints`| `requireAdmin` | Add hint to challenge |
| `PUT` | `/api/admin/challenges/:id/hints/:hintId`| `requireAdmin`| Edit existing hint text |
| `DELETE`| `/api/admin/challenges/:id/hints/:hintId`| `requireAdmin`| Delete hint from challenge |
| `PATCH`| `/api/admin/challenges/:id/hints/:hintId/toggle`| `requireAdmin`| Toggle hint visibility (`is_visible`) |
| `POST` | `/api/admin/challenges/:id/assets`| `requireAdmin`| Add media asset to challenge |
| `PUT` | `/api/admin/challenges/:id/assets/:assetId`| `requireAdmin`| Replace / edit asset in challenge |
| `DELETE`| `/api/admin/challenges/:id/assets/:assetId`| `requireAdmin`| Delete asset from challenge |
| `GET` | `/api/admin/challenges/ip-tracking`| `requireAdmin` | Check current IP tracking / location locking status |
| `POST` | `/api/admin/challenges/ip-tracking/toggle`| `requireAdmin`| Toggle or configure IP tracking middleware on/off |
| `GET` | `/api/admin/leaderboard/stream` | `requireAdmin` | Real-time Server-Sent Events (SSE) stream |
| `GET` | `/api/admin/leaderboard/export` | `requireAdmin` | Export full leaderboard as CSV |
| `POST` | `/api/admin/leaderboard/submit` | `requireAdmin` | Directly set score for any team |
| `PATCH`| `/api/admin/leaderboard/:id/adjust`| `requireAdmin` | Adjust team score using positive/negative delta |
| `PUT` | `/api/admin/leaderboard/:id` | `requireAdmin` | Modify team entry attributes by UUID |
| `DELETE`| `/api/admin/leaderboard/:id` | `requireAdmin` | Delete team from leaderboard |
| `POST` | `/api/admin/leaderboard/reset` | `requireAdmin` | Reset all leaderboard entries |
| `POST` | `/api/god/auth/verify-login` | Public + Key | Super Admin verification entry point |
| `POST` | `/api/god/auth/grant-god-role` | `requireGod` | Promote an admin to Super Admin (`GOD`) |
| `GET` | `/api/god/logs` | `requireGod` | Fetch immutable administrative audit logs |
| `DELETE`| `/api/god/logs` | `requireGod` | Clear all administrative audit logs |
| `DELETE`| `/api/god/logs/:id` | `requireGod` | Delete single administrative audit log entry |

---

## 3. Comprehensive Endpoint Details

### 3.1. Public & Discovery Endpoints

#### `GET /`
- **Access**: Public
- **Description**: Returns top-level service status and confirmation that the API is UP.
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "service": "Cicada 2067 Backend API",
    "status": "UP"
  }
  ```

#### `GET /api`
- **Access**: Public
- **Description**: Returns quick-reference links to primary sub-routes.
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "service": "Cicada 2067 Backend API",
    "status": "UP",
    "endpoints": {
      "auth": "/api/auth/login",
      "challenges": "/api/challenges",
      "leaderboard": "/api/leaderboard",
      "teams": "/api/teams"
    }
  }
  ```

#### `GET /health`
- **Access**: Public
- **Description**: Standard uptime health check endpoint for load balancers and deployment monitoring.
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-08-25T07:30:00.000Z"
  }
  ```

#### `GET /api/health`
- **Access**: Public
- **Description**: Health check confirming database agnosticism and API engine health.
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "message": "Cicada 2067 Backend is live."
  }
  ```

---

### 3.2. User Authentication Endpoints (`/api/auth`)

#### `POST /api/auth/login` (and `/api/auth/verify-login`)
- **Access**: Public
- **Description**: Authenticates a user through either a valid Google OAuth `access_token` or whitelisted `email`. Generates an in-memory session token and sets an HttpOnly `session_token` cookie.
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "participant@cicada2067.org",
    "google_display_name": "Agent Hunter",
    "access_token": "optional_jwt_token_from_google"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Login successful!",
    "is_authenticated": true,
    "role": "participant",
    "user": {
      "id": "u1234567-0000-4000-8000-000000000001",
      "email": "participant@cicada2067.org",
      "display_name": "Agent Hunter",
      "register_no": "22BCE1001",
      "role": "participant",
      "team_id": null
    },
    "redirectUrl": "/dashboard",
    "session_token": "a1b2c3d4e5f6"
  }
  ```
- **Response `403 Forbidden`**: Returned if the email address is not in the whitelist.

#### `GET /api/auth/me`
- **Access**: `requireAuth`
- **Description**: Returns the authenticated user's profile, registration details, assigned team name, and team invite code.
- **Headers**: `Cookie: session_token=...` or `Authorization: Bearer <JWT>` or `x-user-email: <email>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "user": {
      "id": "u1234567-0000-4000-8000-000000000001",
      "email": "participant@cicada2067.org",
      "display_name": "Agent Hunter",
      "register_no": "22BCE1001",
      "role": "participant",
      "team_id": "team-uuid-1",
      "team_name": "CyberKnights",
      "invite_code": "CK99XY",
      "created_at": "2026-08-25T05:00:00.000Z",
      "joined_team_at": "2026-08-25T05:30:00.000Z"
    },
    "team_name": "CyberKnights",
    "invite_code": "CK99XY"
  }
  ```

#### `POST /api/auth/logout`
- **Access**: Public / Authenticated
- **Description**: Destroys the server-side session mapping and clears the client's `session_token` cookie.
- **Headers**: `Cookie: session_token=...`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

#### `POST /api/auth/seed-user`
- **Access**: `requireAdmin`
- **Description**: Whitelists a new participant email into the system. Role is strictly forced to `participant` (preventing privilege escalation via public routes).
- **Headers**: `x-admin-key: {{adminKey}}`
- **Request Body**:
  ```json
  {
    "email": "participant2@vitstudent.ac.in",
    "display_name": "Participant Two",
    "register_no": "22BCE1002"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "User added to whitelist!",
    "id": "new-user-uuid",
    "role": "participant"
  }
  ```

---

### 3.3. User Team Collaboration Endpoints (`/api/teams`)

All user team endpoints enforce `requireAuth`. Authenticated user context (`req.user`) is utilized for all operations.

#### `GET /api/teams/me`
- **Access**: `requireAuth`
- **Description**: Fetches the complete team entity, full member roster, and **`invite_code`** for the authenticated user's current team. All members of the team can call this endpoint to view and share their team's invite code.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "team_id": "team-uuid-1",
    "team_name": "CyberKnights",
    "invite_code": "CK99XY",
    "leader_id": "u1234567-0000-4000-8000-000000000001",
    "team": {
      "id": "team-uuid-1",
      "name": "CyberKnights",
      "invite_code": "CK99XY",
      "leader_id": "u1234567-0000-4000-8000-000000000001",
      "is_disqualified": false,
      "points": 100
    },
    "members": [
      {
        "id": "u1234567-0000-4000-8000-000000000001",
        "email": "leader@cicada2067.org",
        "display_name": "Team Leader",
        "register_no": "22BCE1001",
        "role": "participant"
      }
    ]
  }
  ```

#### `GET /api/teams/me/members`
- **Access**: `requireAuth`
- **Description**: Lists all members currently enrolled in the authenticated user's team along with team name and invite code.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "invite_code": "CK99XY",
    "team_name": "CyberKnights",
    "team_id": "team-uuid-1",
    "data": [
      {
        "id": "u1234567-0000-4000-8000-000000000001",
        "email": "leader@cicada2067.org",
        "display_name": "Team Leader",
        "register_no": "22BCE1001",
        "role": "participant"
      }
    ]
  }
  ```

#### `POST /api/teams/create`
- **Access**: `requireAuth`
- **Description**: Creates a new team and appoints the authenticated user as the Leader. Automatically generates a unique 6-character uppercase alphanumeric `invite_code`.
- **Validation**: Team name regex `/^[a-zA-Z0-9 _-]+$/` to prevent SQL/script injection.
- **Request Body**:
  ```json
  {
    "team_name": "CyberKnights"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Team created successfully!",
    "team_id": "team-uuid-1",
    "invite_code": "CK99XY"
  }
  ```

#### `POST /api/teams/join`
- **Access**: `requireAuth`
- **Description**: Enrolls the authenticated user into an existing team using the team's 6-character `invite_code`.
- **Validation**: Enforces a strict maximum capacity of 5 members per team. User cannot already belong to another team.
- **Request Body**:
  ```json
  {
    "invite_code": "CK99XY"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Successfully joined the team!",
    "team_id": "team-uuid-1"
  }
  ```

#### `POST /api/teams/update-name`
- **Access**: `requireAuth` (Team Leader Only)
- **Description**: Renames the user's team. Verifies `team.leader_id === req.user.id`.
- **Request Body**:
  ```json
  {
    "new_team_name": "CyberKnights Prime"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Team name updated successfully!"
  }
  ```

#### `POST /api/teams/leave`
- **Access**: `requireAuth` (Non-Leader Members Only)
- **Description**: Removes the user from their team. Team leaders are blocked from leaving (they must transfer leadership or have an admin delete the team).
- **Request Body**: `{}`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Successfully left the team."
  }
  ```

---

### 3.4. User Challenge & Story Engine (`/api/challenges`)

All participant challenge routes enforce `requireAuth`.

#### `GET /api/challenges`
- **Access**: `requireAuth`
- **Description**: Lists all active challenges with dynamic lock status (`is_locked: boolean`). Answer keys are strictly excluded. Hints are filtered to only return items where `is_visible === true`.
- **Security Features**:
  - **Same-IP Lock**: Records client IP on retrieval and restricts future submissions to the same origin IP.
  - **Dynamic Timer**: Starts the challenge countdown clock from the moment the team first accesses the challenge.
- **Query Parameters**: `team_name` (optional, defaults to authenticated user's team)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Active challenges fetched successfully",
    "data": [
      {
        "id": "7b587b1c-30b6-4b8a-8c6e-21a4f028442a",
        "order_number": 1,
        "name": "Archive 01: Transmission Beacon",
        "story_context": "A hidden transmission was intercepted across the network...",
        "assets": [
          {
            "type": "text",
            "content": "Encrypted Payload: 0x4369636164613236"
          },
          {
            "type": "image",
            "url": "/api/challenges/assets/masked?c=7b587b1c-30b6-4b8a-8c6e-21a4f028442a&i=1",
            "name": "Beacon Spectrum Analysis"
          }
        ],
        "hints": [
          {
            "id": "hint-01",
            "text": "Inspect the high-frequency harmonics of the radio broadcast.",
            "is_visible": true
          }
        ],
        "is_active": true,
        "is_locked": false
      }
    ]
  }
  ```

#### `GET /api/challenges/:identifier`
- **Access**: `requireAuth`
- **Description**: Retrieves detailed challenge metadata by either order number (e.g. `1`) or UUID.
- **Response `200 OK`**: Returns challenge object.
- **Response `400 Bad Request`**: Returned if the challenge is locked for the requesting team.

#### `POST /api/challenges/submit`
- **Access**: `requireAuth`
- **Description**: Submits an answer guess. Performs case-insensitive, whitespace-trimmed matching against `answer_key`. Automatically updates live leaderboard points, unlocks the next challenge sequentially, and writes to `submission_logs`.
- **Rate Limiting**: Sliding window rate limiter of **5 attempts per minute per IP and Team Name**.
- **Request Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "challenge_identifier": 1,
    "answer": "CICADA26_START"
  }
  ```
- **Response `200 OK` (Correct Answer)**:
  ```json
  {
    "success": true,
    "message": "Correct answer! Next challenge unlocked automatically.",
    "unlocked_next_challenge": 2,
    "story_fragment": {
      "title": "Mission Log #102",
      "header": "Beacon Online",
      "content": "Signal acquisition established. Coordinates logged."
    }
  }
  ```
- **Response `400 Bad Request` (Incorrect Answer)**:
  ```json
  {
    "success": false,
    "message": "Incorrect answer. Please try again.",
    "tryAgain": true
  }
  ```

#### `GET /api/challenges/progress`
- **Access**: `requireAuth`
- **Description**: Participant state recovery endpoint for session resumption post-logout.
- **Query Parameters**: `team_name` (optional)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "team_name": "CyberKnights",
      "current_challenge_order": 2,
      "completed_challenges": [1],
      "challenges_solved": 1,
      "unlocked_story_fragments": [
        {
          "challenge_order": 1,
          "challenge_name": "Archive 01: Transmission Beacon",
          "story_fragment": {
            "title": "Mission Log #102",
            "content": "Signal acquisition established."
          }
        }
      ]
    }
  }
  ```

#### `GET /api/challenges/story-fragments`
- **Access**: `requireAuth`
- **Description**: Archive page endpoint returning all unlocked story fragments solved by the team.
- **Query Parameters**: `team_name` (optional)
- **Response `200 OK`**: Array of unlocked story fragments.

#### `GET /api/challenges/assets/masked`
- **Access**: `requireAuth`
- **Description**: Backend media proxy that conceals external storage URLs (preventing answer inspection via origin URL inspection). Streams binary content directly.
- **Query Parameters**:
  - `c`: Challenge ID
  - `i`: Asset Index
- **Response**: Proxied binary stream (`image/*`, `application/pdf`, `audio/*`, `video/*`).

---

### 3.5. User Leaderboard (`/api/leaderboard`)

#### `GET /api/leaderboard`
- **Access**: `requireAuth`
- **Description**: Real-time ordered rankings computed by:
  1. `challenges_completed` (Descending — Primary)
  2. `completion_time` / `total_time_taken` (Ascending — Tie-breaker)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Live leaderboard fetched successfully",
    "data": [
      {
        "rank": 1,
        "id": "team-uuid-1",
        "team_name": "CyberKnights",
        "challenges_completed": 5,
        "completion_time": "2026-08-25T11:45:00.000Z"
      }
    ]
  }
  ```

---

### 3.6. Admin User & Role Management (`/api/admin/auth`)

All routes require `requireAdmin`.

#### `GET /api/admin/auth/users` (and `/api/admin/users`)
- **Access**: `requireAdmin`
- **Description**: Returns all registered users with emails, display names, registration numbers, roles, and team assignments.
- **Response `200 OK`**: Array of user records.

#### `POST /api/admin/auth/approve-admin` (and `/api/admin/approve-admin`)
- **Access**: `requireAdmin`
- **Description**: Approves a user account for administrator privileges.
- **Request Body**: `{ "target_email": "admin@cicada2067.org" }` or `{ "target_user_id": "uuid" }`

#### `POST /api/admin/auth/toggle-role` (and `/api/admin/toggle-role`)
- **Access**: `requireAdmin`
- **Description**: Modifies user role to `participant`, `admin`, or `GOD`.
- **Request Body**:
  ```json
  {
    "target_email": "user@cicada2067.org",
    "role": "admin"
  }
  ```

#### `POST /api/admin/auth/delete-user` (and `/api/admin/delete-user`)
- **Access**: `requireAdmin`
- **Description**: Deletes a user account from database.
- **Request Body**: `{ "target_email": "user@cicada2067.org" }`

#### `POST /api/admin/auth/bulk-import-admins` (and `/import-admins`)
- **Access**: `requireAdmin`
- **Description**: Bulk creates or updates admin accounts from a CSV string or JSON array of admin objects.
- **Request Body**:
  ```json
  {
    "csv_data": "email,display_name,register_no\nadmin1@cicada2067.org,Alpha Admin,ADM-01\nadmin2@cicada2067.org,Beta Admin,ADM-02"
  }
  ```
- **Response `200 OK`**: Summary of processed, created, updated, and failed counts.

---

### 3.7. Admin Team Operations (`/api/admin/teams`)

All routes require `requireAdmin`.

#### `GET /api/admin/teams/all`
- **Access**: `requireAdmin`
- **Description**: Lists all teams and their enrolled member profiles.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "team-uuid-1",
        "name": "CyberKnights",
        "invite_code": "CK99XY",
        "leader_id": "leader-uuid",
        "created_at": "2026-08-25T05:00:00Z",
        "users": [
          {
            "id": "u1",
            "email": "member@cicada2067.org",
            "display_name": "Member Name",
            "register_no": "22BCE1001"
          }
        ]
      }
    ]
  }
  ```

#### `POST /api/admin/teams/remove-member`
- **Access**: `requireAdmin`
- **Description**: Force-removes a user from a team.
- **Request Body**:
  ```json
  {
    "team_id": "team-uuid-1",
    "target_user_id": "u1"
  }
  ```

#### `POST /api/admin/teams/delete-team`
- **Access**: `requireAdmin`
- **Description**: Force-deletes a team and unlinks enrolled members.
- **Request Body**:
  ```json
  {
    "team_id": "team-uuid-1"
  }
  ```

#### `PATCH /api/admin/teams/:id/score`
- **Access**: `requireAdmin`
- **Description**: Directly adjusts a team's score points. Accepts team UUID or team name.
- **Request Body**:
  ```json
  {
    "delta": 10,
    "exact": 150
  }
  ```
- **Response `200 OK`**: Returns updated `newScore`.

---

### 3.8. Admin Challenge Engine (`/api/admin/challenges`)

All routes require `requireAdmin`.

#### `GET /api/admin/challenges/all`
- **Access**: `requireAdmin`
- **Description**: Retrieves all challenge records including answer keys, raw asset URLs, and hidden hints.

#### `GET /api/admin/challenges/progress`
- **Access**: `requireAdmin`
- **Description**: Progress matrix across all teams with attempt counts, solve status, and timestamps.

#### `POST /api/admin/challenges`
- **Access**: `requireAdmin`
- **Description**: Creates a new challenge record with assets, hints, and story fragment.
- **Request Body**:
  ```json
  {
    "order_number": 5,
    "name": "Archive 05: Vault",
    "story_context": "Accessing vault.",
    "assets": [
      { "type": "image", "url": "https://images.unsplash.com/...", "name": "Map" }
    ],
    "hints": [
      { "text": "Inspect the radio frequency.", "is_visible": true }
    ],
    "story_fragment": {
      "title": "Deciphered Log Entry",
      "content": "All vaults unsealed."
    },
    "answer_key": "VAULT_OPEN_2026",
    "time_limit": 1800,
    "is_active": true
  }
  ```

#### `PUT /api/admin/challenges/:id`
- **Access**: `requireAdmin`
- **Description**: Updates challenge attributes (name, story context, answer key, time limit, is_active).

#### `DELETE /api/admin/challenges/:id`
- **Access**: `requireAdmin`
- **Description**: Deletes a challenge record.

#### `POST /api/admin/challenges/override`
- **Access**: `requireAdmin`
- **Description**: Force-unlocks progression up to a specific challenge order for a team.
- **Request Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "target_challenge_order": 3
  }
  ```

#### `POST /api/admin/challenges/reset-team`
- **Access**: `requireAdmin`
- **Description**: Resets a team's progress back to challenge 1.
- **Request Body**:
  ```json
  {
    "team_name": "CyberKnights"
  }
  ```

#### `GET /api/admin/challenges/submission-logs`
- **Access**: `requireAdmin`
- **Description**: Fetches answers submitted by participants for inspection. Supports `limit` and `team_name` query parameters.

#### Hint Management Sub-Routes:
- `POST /api/admin/challenges/:id/hints`: Add hint (`{ "text": "...", "is_visible": true }`).
- `PUT /api/admin/challenges/:id/hints/:hintId`: Edit hint text (`{ "text": "..." }`).
- `DELETE /api/admin/challenges/:id/hints/:hintId`: Delete hint.
- `PATCH /api/admin/challenges/:id/hints/:hintId/toggle`: Toggle hint visibility.

#### Asset Management Sub-Routes:
- `POST /api/admin/challenges/:id/assets`: Add asset (`image`, `pdf`, `audio`, `video`, `file`, `text`).
- `PUT /api/admin/challenges/:id/assets/:assetId`: Edit asset.
- `DELETE /api/admin/challenges/:id/assets/:assetId`: Delete asset.

#### IP Tracking & Location Lock Sub-Routes:
- `GET /api/admin/challenges/ip-tracking` (and `/ip-blocking`): Returns whether Same-IP location locking middleware is active.
- `POST /api/admin/challenges/ip-tracking/toggle` (and `/toggle-ip-tracking`, `PATCH /ip-tracking`): Turn IP tracking middleware on or off. Accepts optional `{ "enabled": boolean }`.

---

### 3.9. Admin Leaderboard & Real-Time Streaming (`/api/admin/leaderboard`)

All routes require `requireAdmin`.

#### `GET /api/admin/leaderboard/stream`
- **Access**: `requireAdmin`
- **Description**: Persistent Server-Sent Events (SSE) stream broadcasting real-time ranking updates.
- **Headers**: `Accept: text/event-stream`

#### `GET /api/admin/leaderboard/export` (and `/export/csv`)
- **Access**: `requireAdmin`
- **Description**: Exports the current leaderboard as a downloadable CSV file.

#### `POST /api/admin/leaderboard/submit` (and `/score`)
- **Access**: `requireAdmin`
- **Description**: Directly assigns a score to any team.
- **Request Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "challenges_completed": 10
  }
  ```

#### `PATCH /api/admin/leaderboard/:id/adjust` (and `/:id/increment`)
- **Access**: `requireAdmin`
- **Description**: Adds or subtracts score points using delta.
- **Request Body**:
  ```json
  {
    "delta": 5
  }
  ```

#### `PUT /api/admin/leaderboard/:id`
- **Access**: `requireAdmin`
- **Description**: Updates team leaderboard entry by ID.

#### `DELETE /api/admin/leaderboard/:id`
- **Access**: `requireAdmin`
- **Description**: Deletes a team entry from the leaderboard.

#### `POST /api/admin/leaderboard/reset`
- **Access**: `requireAdmin`
- **Description**: Resets all team scores across the leaderboard.

---

### 3.10. Super Admin GOD Services (`/api/god`)

#### `POST /api/god/auth/verify-login`
- **Access**: Public with `x-god-key`
- **Description**: Super Admin login verification route.
- **Headers**: `x-god-key: <GOD_API_KEY>`

#### `POST /api/god/auth/grant-god-role`
- **Access**: `requireGod`
- **Description**: Promotes an administrator to Super Admin (`GOD`).
- **Request Body**: `{ "target_email": "admin@cicada2067.org" }`

#### `GET /api/god/logs`
- **Access**: `requireGod`
- **Description**: Retrieves immutable administrative audit logs. Supports `limit` query param.

#### `DELETE /api/god/logs`
- **Access**: `requireGod`
- **Description**: Clears all administrative audit logs.

#### `DELETE /api/god/logs/:id`
- **Access**: `requireGod`
- **Description**: Deletes a specific administrative audit log entry by ID.

---

## 4. Bruno API Collection Mapping

| Bruno Directory | File Name | Route | Method | Access |
| :--- | :--- | :--- | :--- | :--- |
| `bruno/` | `Health Check.bru` | `/health` | `GET` | Public |
| `bruno/` | `API Health Check.bru` | `/api/health` | `GET` | Public |
| `bruno/auth/user/` | `01_Seed_User.bru` | `/api/auth/seed-user` | `POST` | Admin |
| `bruno/auth/user/` | `02_User_Login.bru` | `/api/auth/login` | `POST` | Public |
| `bruno/auth/user/` | `02_Verify_Login.bru` | `/api/auth/verify-login` | `POST` | Public |
| `bruno/auth/user/` | `03_Get_Profile.bru` | `/api/auth/me` | `GET` | User |
| `bruno/auth/user/` | `04_Logout.bru` | `/api/auth/logout` | `POST` | User |
| `bruno/auth/admin/` | `03_Approve_Admin.bru` | `/api/admin/auth/approve-admin` | `POST` | Admin |
| `bruno/auth/admin/` | `04_Toggle_Admin_Role.bru` | `/api/admin/auth/toggle-role` | `POST` | Admin |
| `bruno/auth/admin/` | `05_List_All_Users.bru` | `/api/admin/auth/users` | `GET` | Admin |
| `bruno/auth/admin/` | `06_Admin_Delete_User.bru` | `/api/admin/auth/delete-user` | `POST` | Admin |
| `bruno/auth/admin/` | `Bulk_Import_Admins_CSV.bru` | `/api/admin/auth/bulk-import-admins` | `POST` | Admin |
| `bruno/teams/user/` | `01_Create_Team.bru` | `/api/teams/create` | `POST` | User |
| `bruno/teams/user/` | `02_Join_Team.bru` | `/api/teams/join` | `POST` | User |
| `bruno/teams/user/` | `03_Update_Team_Name.bru` | `/api/teams/update-name` | `POST` | User |
| `bruno/teams/user/` | `04_Leave_Team.bru` | `/api/teams/leave` | `POST` | User |
| `bruno/teams/user/` | `05_Get_My_Team.bru` | `/api/teams/me` | `GET` | User |
| `bruno/teams/user/` | `06_Get_My_Team_Members.bru` | `/api/teams/me/members` | `GET` | User |
| `bruno/teams/admin/` | `01_Get_All_Teams.bru` | `/api/admin/teams/all` | `GET` | Admin |
| `bruno/teams/admin/` | `04_Remove_Member.bru` | `/api/admin/teams/remove-member` | `POST` | Admin |
| `bruno/teams/admin/` | `05_Admin_Delete_Team.bru` | `/api/admin/teams/delete-team` | `POST` | Admin |
| `bruno/teams/admin/` | `06_Admin_Adjust_Team_Score.bru` | `/api/admin/teams/:id/score` | `PATCH` | Admin |
| `bruno/challenges/user/` | `Get Public Challenges.bru` | `/api/challenges` | `GET` | User |
| `bruno/challenges/user/` | `Get Single Challenge.bru` | `/api/challenges/:identifier` | `GET` | User |
| `bruno/challenges/user/` | `Submit Challenge Answer.bru` | `/api/challenges/submit` | `POST` | User |
| `bruno/challenges/user/` | `Get Participant Progress.bru` | `/api/challenges/progress` | `GET` | User |
| `bruno/challenges/user/` | `Get Unlocked Story Fragments (Archive).bru` | `/api/challenges/story-fragments` | `GET` | User |
| `bruno/challenges/user/` | `Get Masked Asset.bru` | `/api/challenges/assets/masked` | `GET` | User |
| `bruno/challenges/admin/` | `Get All Challenges (Admin).bru` | `/api/admin/challenges/all` | `GET` | Admin |
| `bruno/challenges/admin/` | `Create Challenge with All Assets (Admin).bru` | `/api/admin/challenges` | `POST` | Admin |
| `bruno/challenges/admin/` | `Update Challenge Time Limit (Admin).bru` | `/api/admin/challenges/:id` | `PUT` | Admin |
| `bruno/challenges/admin/` | `Delete Challenge (Admin).bru` | `/api/admin/challenges/:id` | `DELETE` | Admin |
| `bruno/challenges/admin/` | `Get Admin Progress Tracking.bru` | `/api/admin/challenges/progress` | `GET` | Admin |
| `bruno/challenges/admin/` | `Admin Override Unlock.bru` | `/api/admin/challenges/override` | `POST` | Admin |
| `bruno/challenges/admin/` | `Reset Team Progress (Admin).bru` | `/api/admin/challenges/reset-team` | `POST` | Admin |
| `bruno/challenges/admin/` | `Get Submission Logs (Admin).bru` | `/api/admin/challenges/submission-logs` | `GET` | Admin |
| `bruno/challenges/admin/` | `Add Hint.bru` | `/api/admin/challenges/:id/hints` | `POST` | Admin |
| `bruno/challenges/admin/` | `Edit Hint.bru` | `/api/admin/challenges/:id/hints/:hintId` | `PUT` | Admin |
| `bruno/challenges/admin/` | `Delete Hint.bru` | `/api/admin/challenges/:id/hints/:hintId` | `DELETE` | Admin |
| `bruno/challenges/admin/` | `Toggle Hint.bru` | `/api/admin/challenges/:id/hints/:hintId/toggle` | `PATCH` | Admin |
| `bruno/challenges/admin/` | `Add Asset.bru` | `/api/admin/challenges/:id/assets` | `POST` | Admin |
| `bruno/challenges/admin/` | `Edit Asset.bru` | `/api/admin/challenges/:id/assets/:assetId` | `PUT` | Admin |
| `bruno/challenges/admin/` | `Delete Asset.bru` | `/api/admin/challenges/:id/assets/:assetId` | `DELETE` | Admin |
| `bruno/leaderboard/user/` | `Get Live Leaderboard.bru` | `/api/leaderboard` | `GET` | User |
| `bruno/leaderboard/admin/` | `Live Stream SSE.bru` | `/api/admin/leaderboard/stream` | `GET` | Admin |
| `bruno/leaderboard/admin/` | `Export Leaderboard CSV (Admin).bru` | `/api/admin/leaderboard/export` | `GET` | Admin |
| `bruno/leaderboard/admin/` | `Set Any Score (by Team Name).bru` | `/api/admin/leaderboard/submit` | `POST` | Admin |
| `bruno/leaderboard/admin/` | `Adjust Score Delta (Add or Subtract).bru` | `/api/admin/leaderboard/:id/adjust` | `PATCH` | Admin |
| `bruno/leaderboard/admin/` | `Update Team Details (Admin).bru` | `/api/admin/leaderboard/:id` | `PUT` | Admin |
| `bruno/leaderboard/admin/` | `Delete Team.bru` | `/api/admin/leaderboard/:id` | `DELETE` | Admin |
| `bruno/leaderboard/admin/` | `Reset Leaderboard.bru` | `/api/admin/leaderboard/reset` | `POST` | Admin |
| `bruno/god/` | `01_Verify_God_Login.bru` | `/api/god/auth/verify-login` | `POST` | GOD |
| `bruno/god/` | `02_Get_Admin_Logs.bru` | `/api/god/logs` | `GET` | GOD |
| `bruno/god/` | `03_Clear_Admin_Logs.bru` | `/api/god/logs` | `DELETE` | GOD |
| `bruno/god/` | `04_Grant_God_Role.bru` | `/api/god/auth/grant-god-role` | `POST` | GOD |
| `bruno/god/` | `05_Delete_Single_Admin_Log.bru` | `/api/god/logs/:id` | `DELETE` | GOD |
