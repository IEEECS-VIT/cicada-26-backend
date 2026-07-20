# 🚀 Cicada '26 - Backend API Routes Documentation

Complete API documentation for the **Cicada '26 Live Leaderboard System** backed by Supabase.

---

## 🔐 Authentication & Access Control

- **Public Endpoints**: Accessible without any headers.
- **Admin Endpoints**: Require the `x-admin-key` header matching your `.env` secret:
  ```http
  x-admin-key: your_admin_api_key_here
  ```

---

## 📊 Summary of API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Check backend API health status |
| `GET` | `/api/leaderboard` | Public | Get ordered live leaderboard snapshot |
| `GET` | `/api/leaderboard/stream` | Public | Server-Sent Events (SSE) live real-time stream |
| `POST` | `/api/leaderboard/submit` | **Admin** | Set/submit score for any team directly by `team_name` |
| `POST` | `/api/leaderboard/score` | **Admin** | Alias endpoint for score submission |
| `PATCH` | `/api/leaderboard/:identifier/adjust` | **Admin** | Adjust score by adding/subtracting points (`delta`) by team name or ID |
| `PUT` | `/api/leaderboard/:id` | **Admin** | Update team details by entry ID |
| `DELETE` | `/api/leaderboard/:identifier` | **Admin** | Delete team entry by name or ID |
| `POST` | `/api/leaderboard/reset` | **Admin** | Clear/reset all leaderboard entries |

---

## 📑 Detailed Endpoint Documentation

### 1. Health Check
Checks if the Express server and API services are running.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-07-19T18:40:00.000Z",
    "service": "Cicada-26 Leaderboard API"
  }
  ```

---

### 2. Get Live Leaderboard Snapshot
Returns the current leaderboard ordered according to contest rules:
1. **Challenges Completed** (`DESC` - Highest first)
2. **Completion Time** (`ASC` - Lowest time taken / earliest completion first)

- **Method**: `GET`
- **Path**: `/api/leaderboard`
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Live leaderboard fetched successfully",
    "data": [
      {
        "rank": 1,
        "id": "98f7151b-253c-4ee8-9c8a-3755eb41173c",
        "team_name": "CyberKnights",
        "challenges_completed": 15,
        "completion_time": "2026-07-19T11:46:32.511Z",
        "created_at": "2026-07-19T12:01:32.511Z",
        "updated_at": "2026-07-19T13:01:12.511Z"
      },
      {
        "rank": 2,
        "id": "f3b945f5-72d8-4693-a230-83d672134c4e",
        "team_name": "AlphaTeam",
        "challenges_completed": 8,
        "completion_time": "2026-07-19T12:54:26.671Z",
        "created_at": "2026-07-19T12:12:30.367Z",
        "updated_at": "2026-07-19T12:54:25.858Z"
      }
    ]
  }
  ```

---

### 3. Real-Time Live Leaderboard Stream (SSE)
Establishes a persistent Server-Sent Events (SSE) connection. Whenever an admin or challenge submission alters scores in Supabase, an update event is pushed instantly.

- **Method**: `GET`
- **Path**: `/api/leaderboard/stream`
- **Headers**: `Accept: text/event-stream`
- **Stream Event Output**:
  ```http
  data: {"event":"initial","leaderboard":[...]}

  data: {"event":"update","leaderboard":[...]}
  ```

---

### 4. Set / Override Team Score (Admin)
Sets any score for any team directly by `team_name`. Creates the team if it doesn't exist, or updates its completed challenges count to the exact number provided.

- **Method**: `POST`
- **Path**: `/api/leaderboard/submit` (or `/api/leaderboard/score`)
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "challenges_completed": 15,
    "completion_time": "2026-07-19T13:00:00.000Z" // Optional timestamp
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Score for team 'CyberKnights' set to 15 instantly",
    "data": {
      "rank": 1,
      "id": "98f7151b-253c-4ee8-9c8a-3755eb41173c",
      "team_name": "CyberKnights",
      "challenges_completed": 15,
      "completion_time": "2026-07-19T13:00:00.000Z"
    }
  }
  ```

---

### 5. Adjust Score Delta (Admin)
Adds or subtracts points (`delta`) for any team by `team_name` or `id`.

- **Method**: `PATCH`
- **Path**: `/api/leaderboard/:identifier/adjust` (e.g. `/api/leaderboard/CyberKnights/adjust`)
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "delta": 5 // Use positive number to add points (+5), or negative to deduct (-2)
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Score for 'CyberKnights' adjusted by +5",
    "data": {
      "rank": 1,
      "id": "98f7151b-253c-4ee8-9c8a-3755eb41173c",
      "team_name": "CyberKnights",
      "challenges_completed": 20
    }
  }
  ```

---

### 6. Update Team Details by ID (Admin)
Updates specific fields of a team entry by its UUID.

- **Method**: `PUT`
- **Path**: `/api/leaderboard/:id`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "CyberKnights Modified",
    "challenges_completed": 22
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Team entry modified successfully in Supabase backend",
    "data": { ... }
  }
  ```

---

### 7. Delete Team (Admin)
Removes a team entry from the leaderboard by `team_name` or `id`.

- **Method**: `DELETE`
- **Path**: `/api/leaderboard/:identifier` (e.g. `/api/leaderboard/Hackerman`)
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Team 'Hackerman' deleted instantly from Supabase backend"
  }
  ```

---

### 8. Reset Leaderboard (Admin)
Clears all team entries from the leaderboard.

- **Method**: `POST`
- **Path**: `/api/leaderboard/reset`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Leaderboard reset successfully across Supabase backend"
  }
  ```
