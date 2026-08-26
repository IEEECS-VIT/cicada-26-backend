-- Migration: Add points column to teams table.
-- The admin score-adjustment endpoint (adminTeamController.adjustScore, PATCH
-- /api/admin/teams/:id/score) and userTeamController.ts already read/write
-- teams.points, but no migration ever created the column — confirmed missing
-- via a live PATCH /score call returning "Could not find the 'points' column
-- of 'teams' in the schema cache". Without this column, score adjustments
-- silently fail at the database layer.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
