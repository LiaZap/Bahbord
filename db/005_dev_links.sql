CREATE TABLE IF NOT EXISTS dev_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('branch', 'pull_request', 'commit')),
  title TEXT NOT NULL,
  url TEXT,
  status TEXT, -- e.g. 'open', 'merged', 'closed'
  provider TEXT DEFAULT 'github', -- github, gitlab, bitbucket
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_links_ticket_id ON dev_links(ticket_id);
