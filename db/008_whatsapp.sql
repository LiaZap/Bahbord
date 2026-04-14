-- Add phone to members for WhatsApp notifications
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT;

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('app', 'email', 'whatsapp')),
  event TEXT NOT NULL, -- 'ticket.assigned', 'ticket.mentioned', 'comment.created', etc.
  is_enabled BOOLEAN DEFAULT true,
  UNIQUE(member_id, channel, event)
);
