-- Migration: Add started_ip column to team_progress table to track team challenge location IPs
ALTER TABLE public.team_progress ADD COLUMN IF NOT EXISTS started_ip VARCHAR(45);
