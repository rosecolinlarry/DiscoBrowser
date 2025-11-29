-- Collapse all tasks in conversation tree under one parent by appended TASK
UPDATE dialogues
SET displayTitle = CONCAT('TASK', ' / ', title)
WHERE type = 'task';