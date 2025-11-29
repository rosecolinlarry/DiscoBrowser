-- Add column for display text
ALTER TABLE dialogues ADD COLUMN displayTitle TEXT DEFAULT '';
-- Copy original titles
UPDATE dialogues
SET displayTitle = title
WHERE displayTitle IS NULL;