# Implementation Record

This document provides a formal record of the features and enhancements that have been implemented, as well as proposed future enhancements for the Cicada '26 Backend Services.

---

## 1. Implemented Features

### 1.1. Core Infrastructure and Database
* **Database Setup**: Initialized schemas for teams, users, challenges, team progress, and submission logs in Postgres/Supabase.
* **Row-Level Security (RLS)**: Configured RLS policies on tables to ensure data access control.
* **Realtime Publication**: Enabled real-time publications for active database tables to support streaming.
* **View Security Enhancement**: Reconfigured the `public.live_leaderboard` view from `SECURITY DEFINER` to `SECURITY INVOKER` using the Postgres `WITH (security_invoker = true)` clause. This ensures that Postgres permissions and RLS policies of the querying client are strictly enforced.

### 1.2. Authentication and User Dashboard
* **Authentication Middleware**: Implemented `requireAuth` and `requireAdmin` middlewares to protect user and admin routes. Supports token-based validation and header-based authentication.
* **User Profile Endpoint**: Created the `GET /api/auth/me` endpoint to fetch the profile details of the authenticated user.
  * Retrieves: User ID, display name, email address, registration number, role, and timestamps.
  * Omitted sensitive attributes and formatted the user's team as a simple top-level `team_name` string attribute (returns `null` if the user is not in a team).
* **API Client Documentation**: Created a Bruno collection file (`03_Get_Profile.bru`) to test and document the profile route.

### 1.3. Challenge Hint System
* **Schema Extension**: Added a nullable `hints` column of type `JSONB` to the `public.challenges` table.
* **Admin Management Endpoints**: Created distinct endpoints for managing hints pointing directly to challenges, allowing routes to accept either the challenge UUID or the `order_number` (challenge number):
  * `POST /api/admin/challenges/:id/hints` — Add a hint to a challenge (defaults to hidden `is_visible: false` with empty text `""`).
  * `PUT /api/admin/challenges/:id/hints/:hintId` — Edit hint text.
  * `DELETE /api/admin/challenges/:id/hints/:hintId` — Delete a hint.
  * `PATCH /api/admin/challenges/:id/hints/:hintId/toggle` — Toggle the visibility of a hint for participants.
* **Data Masking and Security**:
  * For locked challenges, the `hints` attribute is set to `undefined` (completely stripped from payload).
  * For unlocked challenges, hints are filtered at the service boundary to only return items marked as `is_visible: true`.
  * Hint schemas utilize Zod for request body validation.
* **API Client Documentation**: Added Bruno collection files for adding, editing, toggling, and deleting hints under `bruno/challenges/admin`.

### 1.4. Security and Submission Throttling
* **Sliding Window Rate Limiter**: Configured a sliding window log rate limiting middleware on answer submissions (`POST /api/challenges/submit`). Restricts attempts to **5 requests per minute per IP and Team Name** to prevent automated key brute-forcing. Integrates local loopback IP bypass for convenient development testing.
* **Stateful Cookie Sessions**: Implemented stateless-compatible cookie session handling. Successful login requests set an HTTP-only `session_token` cookie, which is automatically parsed and authenticated in subsequent user/admin routes, eliminating the need to manually pass `x-user-email` headers.

### 1.5. Challenge Timing System
* **Access-Activated Challenge Timers**: Resolved skew in challenge progression by making the challenge timer start only when a team retrieves details (`GET /api/challenges/:identifier` / `GET /api/challenges`) or submits an answer.
* **IST Timestamp Synchronization**: Configured returned challenge timestamps (`created_at`, `updated_at`, and `challenge_started_at`) to dynamically represent Indian Standard Time (IST, `+05:30` offset). For active challenges, the `created_at` and `updated_at` timestamps are overwritten with the dynamic session start time to prevent client-side countdown clock errors.

### 1.6. Dynamic IP Protection & URL Masking
* **Same-IP Location Lock & Dynamic Toggle**: Track client IP addresses when challenges are retrieved. Enforce same-IP locks to prevent participants from sharing session data or having experts solve challenges from remote locations. Intercept and block mismatched IPs with a `403 Forbidden` error. Provides an admin toggle (`POST /api/admin/challenges/ip-tracking/toggle`) allowing event administrators to turn IP tracking middleware on and off at runtime without server restarts.
* **Asset URL Masking**: Mask origin storage URLs (e.g. Unsplash, Google Storage) to prevent backtracking. Replaced with proxy endpoint `/api/challenges/assets/masked?c=...&i=...` which validates authorization and streams content securely from the backend.

### 1.7. Administrative Asset Management
* **Asset Management for Admins**: Created specialized admin-only endpoints to add, delete, and replace assets in a challenge's JSONB array, generating unique UUIDs for assets and capturing admin logs.

### 1.8. Round System & Story Fragments
* **Rounds Table**: Added a `rounds` table (migration `00011_add_rounds.sql`) that groups challenges into themed stages via a `round_id` foreign key on `challenges` (with an automatic backfill into a default "Round 1").
* **Fragment Relocation**: Moved story fragments from `challenges.story_fragment` to `rounds.story_fragment`. A challenge's fragment is now resolved from its round at the service layer, and only for rounds the team has entered.
* **Fragment Unlock on Round Entry**: A round's intro fragment is served the moment the team enters the round — either embedded in the first unlocked challenge payload or returned on the submission response when the previous round's final challenge is solved.
* **Round-Aware Progression**: Added `current_round_order` to participant progress and changed `unlocked_story_fragments` to return one fragment per entered round (`{ round_order, round_name, story_fragment }`).
* **Round Masking**: Locked rounds are masked at the service boundary (only `id`, `name`, `order_number`, and `is_locked` are exposed; fragments are `null`).
* **Admin Round Management**: Added CRUD endpoints (`GET/POST /api/admin/challenges/rounds`, `PUT/DELETE /api/admin/challenges/rounds/:id`) plus a `POST /api/admin/challenges/rounds/reorder` reordering RPC (`reorder_rounds`, mirroring the two-phase `reorder_challenges` pattern). Deleting a round with assigned challenges is rejected with a `400`.
* **Security Fix**: Revoked the `authenticated` role's `EXECUTE` privilege on the `reorder_challenges` SECURITY DEFINER function (migration `00008`) to close a privilege escalation vector.

---

## 2. Yet to Be Implemented / Future Recommendations

### 2.1. Security and Hardening
* **Automated Audit Logs**: Expand logging of administrative actions to cover all CRUD changes made to hints.

### 2.2. Analytics and Reporting
* **Admin Dashboard Metrics**: Create analytical endpoints to track submission failure rates, solve times per challenge, and popular hints to assist organizers during the event.
