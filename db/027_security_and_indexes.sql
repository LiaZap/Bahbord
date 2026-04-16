-- 027: Security fixes, FK cascades, indexes, and missing tables

-- ========== FK CASCADE FIXES ==========
-- Tickets: SET NULL on delete (don't cascade-delete tickets when status/service deleted)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_id_fkey FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_service_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_assignee_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_reporter_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_sprint_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_parent_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES tickets(id) ON DELETE SET NULL;

-- Comments: CASCADE on member delete
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE comments ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES members(id) ON DELETE CASCADE;

-- Activity log: SET NULL on member delete
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_member_id_fkey;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;

-- Comment reactions: CASCADE on member delete
ALTER TABLE comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_member_id_fkey;
ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_member_id_fkey FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE;

-- ========== MISSING TABLE ==========
CREATE TABLE IF NOT EXISTS client_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, product_id)
);

-- ========== PERFORMANCE INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_members_workspace_id ON members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tickets_workspace_created ON tickets(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_board_id ON tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_ticket_id ON activity_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_ticket_id ON subtasks(ticket_id);
