-- 026: Ensure subtasks has completed_at column
ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
