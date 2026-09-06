-- 0008_add_task_mood
-- Affective computing: tag tasks with a mood emoji
-- (fun, grind, urgent, thinking, learn, calm) for mood heatmapping.
ALTER TABLE tasks ADD COLUMN mood;
