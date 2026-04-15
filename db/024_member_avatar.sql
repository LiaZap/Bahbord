-- 024: Add avatar_url to members for profile photos
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
