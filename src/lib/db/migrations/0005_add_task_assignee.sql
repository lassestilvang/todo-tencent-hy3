-- 0005_add_task_assignee
-- Task assignment: link a task to the workspace member it is
-- assigned to. Clearing the assignment sets the column to NULL.
ALTER TABLE tasks ADD COLUMN assignee_id TEXT REFERENCES workspace_members(id) ON DELETE SET NULL;
