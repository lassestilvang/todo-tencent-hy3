-- 0007_add_task_source
-- Tracks the origin of a task (e.g. 'browser-extension', 'voice', 'email-digest').
-- Added so the extension and other integrators can attribute tasks to their source.
ALTER TABLE tasks ADD COLUMN source;
