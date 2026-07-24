# API Routes Documentation

Comprehensive API specification for the **Cicada '26 Leaderboard & Challenge Engine Services** backed by Supabase.

---

## Authentication and Access Control

- **Public Endpoints**: Openly accessible without authentication headers.
- **Administrative Endpoints**: Require the `x-admin-key` header (or `admin_key` query parameter) matching the environment configuration:
  ```http
  x-admin-key: <ADMIN_API_KEY>
  ```

---

## Standard Error Response Models

All API error responses follow uniform JSON schemas based on the HTTP status code:

### 1. 401 Unauthorized (Missing or Invalid Admin Key)
Returned when an administrative endpoint is accessed without a valid `x-admin-key` header.
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
}
```

### 2. 400 Bad Request (Validation Failure)
Returned when request parameters or JSON body payloads fail Zod schema validation.
```json
{
  "success": false,
  "error": "Validation Error",
  "details": [
    {
      "code": "too_small",
      "minimum": 0,
      "type": "number",
      "inclusive": true,
      "exact": false,
      "message": "Challenges completed must be 0 or positive",
      "path": [
        "challenges_completed"
      ]
    }
  ]
}
```

### 3. 404 Not Found
Returned when a requested resource (team or challenge record) cannot be located in the backend.
```json
{
  "success": false,
  "error": "Resource not found or inactive"
}
```

### 4. 500 Internal Server Error
Returned when an unhandled server error or database query failure occurs.
```json
{
  "success": false,
  "error": "Internal server error while processing request"
}
```

---

## Summary of API Endpoints

### 1. Leaderboard Endpoints

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System health check and service status |
| `GET` | `/api/leaderboard` | Public | Ordered live leaderboard snapshot |
| `GET` | `/api/admin/leaderboard/stream` | Admin | Server-Sent Events (SSE) real-time streaming endpoint |
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

## Detailed Endpoint Reference & Expected Outcomes

### 1. Health Check
Verifies service availability and operational readiness.

- **Method**: `GET`
- **Path**: `/health`
- **Headers**: None

#### Possible Outcomes:

- **Response `200 OK` (Healthy Service)**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-07-21T20:00:00.000Z",
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

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `500 Internal Server Error`**:
  ```json
  {
    "success": false,
    "error": "Internal server error while fetching leaderboard"
  }
  ```

---

### 3. Server-Sent Events (SSE) Live Stream
Establishes a persistent streaming connection for real-time telemetry updates.

- **Method**: `GET`
- **Path**: `/api/leaderboard/stream`
- **Headers**: `Accept: text/event-stream`

#### Possible Outcomes:

- **Response `200 OK` (Stream Established)**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive

  data: {"event":"initial","leaderboard":[{"rank":1,"team_name":"CyberKnights","challenges_completed":5}]}

  data: {"event":"update","leaderboard":[{"rank":1,"team_name":"CyberKnights","challenges_completed":6}]}
  ```

---

### 4. Public Active Challenges
Returns active challenges with associated story contexts and media payloads (Images, PDFs, Audio, Video, Files, Text). Answer keys are excluded.

- **Method**: `GET`
- **Path**: `/api/challenges`
- **Query Parameters**: `team_name` (Optional - evaluates `is_locked` status per team)

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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
          { "type": "image", "url": "https://images.unsplash.com/photo-1518770660439-4636190af475", "name": "Beacon Spectrum Analysis" }
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

- **Response `500 Internal Server Error`**:
  ```json
  {
    "success": false,
    "error": "Failed to fetch challenges"
  }
  ```

---

### 5. Fetch Single Challenge Details
Retrieves detailed information for a single challenge by order number or UUID.

- **Method**: `GET`
- **Path**: `/api/challenges/:identifier`
- **Query Parameters**: `team_name` (Optional - evaluates lock status)

#### Possible Outcomes:

- **Response `200 OK` (Unlocked Challenge)**:
  ```json
  {
    "success": true,
    "message": "Challenge '1' fetched successfully",
    "data": {
      "id": "7b587b1c-30b6-4b8a-8c6e-21a4f028442a",
      "order_number": 1,
      "name": "Archive 01: Transmission Beacon",
      "story_context": "A hidden transmission was intercepted...",
      "assets": [],
      "story_fragment": {
        "title": "Recovered Mission Log",
        "content": "Signal acquisition established."
      },
      "is_active": true,
      "is_locked": false
    }
  }
  ```

- **Response `400 Bad Request` (Challenge Locked for Team)**:
  ```json
  {
    "success": false,
    "error": "Challenge '2' is locked for team 'CyberKnights'. Complete previous challenges first.",
    "data": {
      "order_number": 2,
      "is_locked": true
    }
  }
  ```

- **Response `404 Not Found` (Non-existent or Inactive Challenge)**:
  ```json
  {
    "success": false,
    "error": "Challenge '99' not found or inactive"
  }
  ```

---

### 6. Submit Challenge Response
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

#### Possible Outcomes:

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

- **Response `400 Bad Request` (Incorrect Solution)**:
  ```json
  {
    "success": false,
    "message": "Incorrect answer. Please try again.",
    "tryAgain": true
  }
  ```

- **Response `400 Bad Request` (Out-of-Order Attempt)**:
  ```json
  {
    "success": false,
    "message": "Challenge 2 is locked for team 'CyberKnights'. Solve challenge 1 first.",
    "tryAgain": false
  }
  ```

- **Response `400 Bad Request` (Validation Error)**:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["team_name"],
        "message": "Team name is required"
      }
    ]
  }
  ```

---

### 7. Participant Session State Recovery
Retrieves current progression metrics and unlocked story fragments to support seamless session resumption following logout.

- **Method**: `GET`
- **Path**: `/api/challenges/progress`
- **Query Parameters**: `team_name` (Required)

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `400 Bad Request` (Missing Parameter)**:
  ```json
  {
    "success": false,
    "error": "Query parameter team_name is required"
  }
  ```

---

### 8. Unlocked Story Fragments (Archive)
Retrieves unlocked story fragments associated with solved challenges for display on the Archive page.

- **Method**: `GET`
- **Path**: `/api/challenges/story-fragments`
- **Query Parameters**: `team_name` (Required)

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `400 Bad Request` (Missing Parameter)**:
  ```json
  {
    "success": false,
    "error": "Query parameter team_name is required"
  }
  ```

---

### 9. Administrative Progress Tracking
Provides a comprehensive progress matrix across all participating teams.

- **Method**: `GET`
- **Path**: `/api/challenges/admin/progress`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 10. Administrative Override Challenge Unlock
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

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Admin override successful. Team 'CyberKnights' unlocked up to challenge 3.",
    "unlocked_next_challenge": 3
  }
  ```

- **Response `400 Bad Request` (Validation Error)**:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      {
        "code": "too_small",
        "minimum": 1,
        "type": "number",
        "message": "Target challenge order must be at least 1",
        "path": ["target_challenge_order"]
      }
    ]
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 11. Fetch All Challenges (Admin)
Retrieves all challenge records including answer keys for administrative inspection.

- **Method**: `GET`
- **Path**: `/api/challenges/admin/all`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "All challenges (admin) fetched successfully",
    "data": [
      {
        "id": "7b587b1c-30b6-4b8a-8c6e-21a4f028442a",
        "order_number": 1,
        "name": "Archive 01: Transmission Beacon",
        "story_context": "A hidden transmission was intercepted...",
        "answer_key": "CICADA26_START",
        "is_active": true
      }
    ]
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 12. Create Challenge Record (Admin)
Creates a new challenge record with associated assets and story fragments.

- **Method**: `POST`
- **Path**: `/api/challenges/admin`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "order_number": 5,
    "name": "Archive 05: Multi-Media Vault",
    "story_context": "Accessing the main archive vault containing all intercepted asset formats.",
    "assets": [
      {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1518770660439-4636190af475",
        "name": "Orbital Map Image"
      }
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

#### Possible Outcomes:

- **Response `201 Created` (Success)**:
  ```json
  {
    "success": true,
    "message": "Challenge 'Archive 05: Multi-Media Vault' created successfully",
    "data": {
      "id": "8c698c2d-41c7-5c9b-9d7f-32b5f039553b",
      "order_number": 5,
      "name": "Archive 05: Multi-Media Vault",
      "answer_key": "VAULT_OPEN_2026",
      "is_active": true
    }
  }
  ```

- **Response `400 Bad Request` (Validation Error)**:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      {
        "code": "invalid_enum_value",
        "options": ["image", "pdf", "audio", "video", "file", "text"],
        "path": ["assets", 0, "type"],
        "message": "Invalid asset type"
      }
    ]
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 13. Update Challenge Record (Admin)
Modifies attributes of an existing challenge.

- **Method**: `PUT`
- **Path**: `/api/challenges/admin/:id`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "name": "Updated Challenge Title",
    "answer_key": "NEW_ANSWER_2026"
  }
  ```

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Challenge '7b587b1c-30b6-4b8a-8c6e-21a4f028442a' updated successfully",
    "data": {
      "id": "7b587b1c-30b6-4b8a-8c6e-21a4f028442a",
      "name": "Updated Challenge Title",
      "answer_key": "NEW_ANSWER_2026"
    }
  }
  ```

- **Response `404 Not Found`**:
  ```json
  {
    "success": false,
    "error": "Challenge '7b587b1c-30b6-4b8a-8c6e-21a4f028442a' not found"
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 14. Delete Challenge Record (Admin)
Deletes a challenge record from the backend repository.

- **Method**: `DELETE`
- **Path**: `/api/challenges/admin/:id`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Challenge '7b587b1c-30b6-4b8a-8c6e-21a4f028442a' deleted successfully"
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 15. Manual Score Override
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

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `400 Bad Request` (Validation Error)**:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      {
        "code": "too_small",
        "minimum": 0,
        "type": "number",
        "message": "Challenges completed must be 0 or positive",
        "path": ["challenges_completed"]
      }
    ]
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 16. Score Delta Adjustment
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

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
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

- **Response `400 Bad Request` (Validation Error)**:
  ```json
  {
    "success": false,
    "error": "Validation Error",
    "details": [
      {
        "code": "invalid_type",
        "expected": "integer",
        "received": "float",
        "path": ["delta"],
        "message": "Expected integer, received float"
      }
    ]
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 17. Update Team Entry (Admin)
Modifies team attributes (e.g., team name, completed challenges) by UUID.

- **Method**: `PUT`
- **Path**: `/api/leaderboard/:id`
- **Headers**:
  - `x-admin-key: <ADMIN_API_KEY>`
  - `Content-Type: application/json`
- **Body**:
  ```json
  {
    "team_name": "AlphaTeam Renamed",
    "challenges_completed": 5
  }
  ```

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Team entry modified successfully in Supabase backend",
    "data": {
      "id": "98f7151b-253c-4ee8-9c8a-3755eb41173c",
      "team_name": "AlphaTeam Renamed",
      "challenges_completed": 5
    }
  }
  ```

- **Response `404 Not Found`**:
  ```json
  {
    "success": false,
    "error": "Leaderboard entry not found"
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 18. Delete Team Entry (Admin)
Deletes a team record from the leaderboard database.

- **Method**: `DELETE`
- **Path**: `/api/leaderboard/:identifier`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Team 'CyberKnights' deleted instantly from Supabase backend"
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```

---

### 19. Reset Leaderboard (Admin)
Resets all leaderboard team records in the backend.

- **Method**: `POST`
- **Path**: `/api/leaderboard/reset`
- **Headers**: `x-admin-key: <ADMIN_API_KEY>`

#### Possible Outcomes:

- **Response `200 OK` (Success)**:
  ```json
  {
    "success": true,
    "message": "Leaderboard reset successfully across Supabase backend"
  }
  ```

- **Response `401 Unauthorized`**:
  ```json
  {
    "success": false,
    "error": "Unauthorized: Invalid or missing Admin API Key (x-admin-key header)"
  }
  ```
