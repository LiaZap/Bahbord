-- 028: Add project_id to sprints (each project has its own sprints)
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
