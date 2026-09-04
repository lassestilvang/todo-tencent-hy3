-- 0006_add_task_assignee_index
-- Speeds up "tasks assigned to me" lookups.
CREATE INDEX tasks_assignee_id_idx ON tasks(assignee_id);
