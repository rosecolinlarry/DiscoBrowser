-- Manually update boardwalk payphone convo from type orb
-- to type flow. Somehow got caught in parser to be an orb.
UPDATE conversations
SET [type] = 'flow'
WHERE [type] = 'orb' AND id = '556'