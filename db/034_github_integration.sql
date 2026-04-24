-- 034: GitHub integration
-- Links GitHub PRs, commits, issues and branches to tickets.
-- Populated via /api/webhooks/github (GitHub webhook).

CREATE TABLE IF NOT EXISTS github_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pr', 'commit', 'issue', 'branch')),
  url TEXT NOT NULL,
  title TEXT,
  state TEXT, -- 'open', 'closed', 'merged'
  number INT,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_links_ticket ON github_links(ticket_id);

-- Dedupe on (ticket_id, url) so webhook replays don't create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_links_ticket_url
  ON github_links(ticket_id, url);
