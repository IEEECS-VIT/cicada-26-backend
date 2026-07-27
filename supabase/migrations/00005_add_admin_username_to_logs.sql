-- Migration: Add admin_username column to admin_logs table
ALTER TABLE public.admin_logs ADD COLUMN IF NOT EXISTS admin_username VARCHAR(255);
