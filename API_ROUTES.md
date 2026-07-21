# API Routes Documentation

Comprehensive API specification for the **Cicada '26 Leaderboard & Challenge Engine Services** backed by Supabase.

---

## Authentication and Access Control

- **Public Endpoints**: Openly accessible without authentication headers.
- **Administrative Endpoints**: Require the `x-admin-key` header matching the environment configuration:
  ```http
  x-admin-key: <ADMIN_API_KEY>
  ```

---

## Summary of API Endpoints

### 1. Leaderboard Endpoints

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System health check and service status |
| `GET` | `/api/leaderboard` | Public | Ordered live leaderboard snapshot |
| `GET` | `/api/leaderboard/stream` | Public | Server-Sent Events (SSE) real-time streaming endpoint |
| `POST` | `/api/leaderboard/submit` | Admin | Directly set score for any team by `team_name` |
| `POST` | `/api/leaderboard/score` | Admin | Alias endpoint for setting team scores |
| `PATCH` | `/api/leaderboard/:identifier/adjust` | Admin | Adjust team score using positive or negative point delta |
| `PUT` | `/api/leaderboard/:id` | Admin | Modify team entry attributes by UUID |
| `DELETE` | `/api/leaderboard/:identifier` | Admin | Delete team entry by name or UUID |
| `POST` | `/api/leaderboard/reset` | Admin | Reset all leaderboard entries |

### 2. Challenge and Story Engine Endpoints

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/challenges` | Public | Fetch active public challenges (optional `team_name` query for lock status) |
| `GET` | `/api/challenges/:identifier` | Public | Fetch challenge details by order number or UUID |
| `POST` | `/api/challenges/submit` | Public | Submit challenge response for validation and automated score sync |
| `GET` | `/api/challenges/progress` | Public | Participant state recovery endpoint for post-logout session resume |
| `GET` | `/api/challenges/story-fragments` | Public | Archive page: Retrieve all unlocked story fragments for a team |
| `GET` | `/api/challenges/admin/progress` | Admin | Detailed progress tracking matrix across all teams |
| `POST` | `/api/challenges/admin/override` | Admin | Force-unlock any challenge order for a specific team |
| `GET` | `/api/challenges/admin/all` | Admin | Fetch all challenge records including answer keys |
| `POST` | `/api/challenges/admin` | Admin | Create a new challenge record |
| `PUT` | `/api/challenges/admin/:id` | Admin | Modify challenge attributes |
| `DELETE` | `/api/challenges/admin/:id` | Admin | Delete a challenge record |

---

## Detailed Endpoint Reference

### 1. Health Check
Verifies service availability and operational readiness.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: None
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-07-20T18:40:00.000Z",
    "service": "Cicada-26 Leaderboard & Challenge API"
  }
  ```

---

### 2. Live Leaderboard Snapshot
Returns the current team rankings compiled according to evaluation criteria:
1. **Challenges Solved** (`DESC` - Primary sorting)
2. **Completion Time** (`ASC` - Secondary tie-breaking sorting)

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
        "challenges_completed": 5,
        "completion_time": "2026-07-20T11:46:32.511Z",
        "created_at": "2026-07-20T12:01:32.511Z",
        "updated_at": "2026-07-20T13:01:12.511Z"
      }
    ]
  }
  ```

---

### 3. Server-Sent Events (SSE) Live Stream
Establishes a persistent streaming connection for real-time telemetry updates.

- **Method**: `GET`
- **Path**: `/api/leaderboard/stream`
- **Headers**: `Accept: text/event-stream`
- **Event Output Format**:
  ```http
  data: {"event":"initial","leaderboard":[...]}

  data: {"event":"update","leaderboard":[...]}
  ```

---

### 4. Public Active Challenges
Returns active challenges with associated story contexts and media payloads (Images, PDFs, Audio, Video, Files, Text). Answer keys are excluded.

- **Method**: `GET`
- **Path**: `/api/challenges`
- **Query Parameters**: `team_name` (Optional - evaluates `is_locked` status per team)
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
        "story_context": "A hidden transmission was intercepted...",
        "assets": [
          { "type": "text", "content": "Signal Payload: 0x4369636164613236" },
          { "type": "image", "url": "https://...", "name": "Beacon Spectrum Analysis" }
        ],
        "story_fragment": {
          "title": "Recovered Mission Log",
          "header": "Day 102",
          "content": "Signal acquisition established."
        },
        "is_active": true,
        "is_locked": false
      }
    ]
  }
  ```

---

### 5. Submit Challenge Response
Validates participant input against challenge solution requirements.
- Performs case-insensitive matching with leading and trailing whitespace trimming.
- Enforces strict sequential challenge progression (blocks out-of-order attempts).
- Automatically increments attempt telemetry, updates team progress, unlocks the next challenge, and updates live leaderboard metrics upon success.

- **Method**: `POST`
- **Path**: `/api/challenges/submit`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "challenge_identifier": 1,
    "answer": "CICADA26_START"
  }
  ```
- **Response `200 OK` (Valid Solution)**:
  ```json
  {
    "success": true,
    "message": "Correct answer! Next challenge unlocked automatically.",
    "unlocked_next_challenge": 2,
    "story_fragment": {
      "title": "Recovered Mission Log",
      "header": "Day 102",
      "content": "Signal acquisition established."
    }
  }
  ```
- **Response `400 Bad Request` (Invalid Solution)**:
  ```json
  {
    "success": false,
    "message": "Incorrect Authentication Key",
    "tryAgain": true
  }
  ```
- **Response `400 Bad Request` (Out-of-Order Attempt)**:
  ```json
  {
    "success": false,
    "message": "Challenge locked. You must complete challenge 1 first before attempting challenge 2.",
    "tryAgain": false
  }
  ```

---

### 6. Participant Session State Recovery
Retrieves current progression metrics and unlocked story fragments to support seamless session resumption following logout.

- **Method**: `GET`
- **Path**: `/api/challenges/progress`
- **Query Parameters**: `team_name` (Required)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Progress state for team 'CyberKnights' fetched successfully",
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
            "title": "Recovered Mission Log",
            "header": "Day 102",
            "content": "Signal acquisition established."
          }
        }
      ]
    }
  }
  ```

---

### 7. Unlocked Story Fragments (Archive)
Retrieves unlocked story fragments associated with solved challenges for display on the Archive page.

- **Method**: `GET`
- **Path**: `/api/challenges/story-fragments`
- **Query Parameters**: `team_name` (Required)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Unlocked story fragments for team 'CyberKnights' fetched successfully",
    "data": [
      {
        "challenge_order": 1,
        "challenge_name": "Archive 01: Transmission Beacon",
        "story_fragment": {
          "title": "Recovered Mission Log",
          "header": "Day 102",
          "content": "Signal acquisition established."
        }
      }
    ]
  }
  ```

---

### 8. Administrative Progress Tracking
Provides comprehensive progress matrix across all participating teams.

- **Method**: `GET`
- **Path**: `/api/challenges/admin/progress`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Admin team progress tracking summary fetched successfully",
    "data": [
      {
        "team_name": "CyberKnights",
        "current_challenge_order": 2,
        "challenges_solved": 1,
        "completion_time": "2026-07-20T12:00:00.000Z",
        "attempts_count": 3,
        "last_attempt_at": "2026-07-20T12:05:00.000Z",
        "story_progress": "1 / 3 fragments unlocked",
        "completed_challenges": [1]
      }
    ]
  }
  ```

---

### 9. Administrative Override Challenge Unlock
Force-unlocks challenge progression for a target team.

- **Method**: `POST`
- **Path**: `/api/challenges/admin/override`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "target_challenge_order": 3
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Admin override successful. Team 'CyberKnights' unlocked up to challenge 3.",
    "unlocked_next_challenge": 3
  }
  ```

---

### 10. Manual Score Override
Directly assigns a completed challenge score to a specified team.

- **Method**: `POST`
- **Path**: `/api/leaderboard/submit`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "CyberKnights",
    "challenges_completed": 5
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Score for team 'CyberKnights' set to 5 instantly",
    "data": {
      "rank": 1,
      "id": "98f7151b-253c-4ee8-9c8a-3755eb41173c",
      "team_name": "CyberKnights",
      "challenges_completed": 5
    }
  }
  ```

---

### 11. Score Delta Adjustment
Adjusts team scores by adding or subtracting points.

- **Method**: `PATCH`
- **Path**: `/api/leaderboard/:identifier/adjust`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "delta": 2
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Score for 'CyberKnights' adjusted by +2",
    "data": {
      "rank": 1,
      "team_name": "CyberKnights",
      "challenges_completed": 7
    }
  }
  ```
