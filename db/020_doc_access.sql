-- Access control for documentation spaces
CREATE TABLE IF NOT EXISTS doc_space_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES doc_spaces(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(space_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_space_roles_space ON doc_space_roles(space_id);
CREATE INDEX IF NOT EXISTS idx_doc_space_roles_member ON doc_space_roles(member_id);
