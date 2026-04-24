-- 031: Add is_client flag on members to distinguish internal staff from external clients
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_client BOOLEAN DEFAULT false;

-- Mark external project members as clients (those who don't have org admin/owner role)
UPDATE members m
SET is_client = true
WHERE NOT EXISTS (
  SELECT 1 FROM org_roles orr
  WHERE orr.member_id = m.id AND orr.role IN ('owner', 'admin')
)
AND EXISTS (
  SELECT 1 FROM board_roles br WHERE br.member_id = m.id
);
