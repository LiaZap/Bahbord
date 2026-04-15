-- Clerk authentication integration
ALTER TABLE members ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_clerk_user_id ON members(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
