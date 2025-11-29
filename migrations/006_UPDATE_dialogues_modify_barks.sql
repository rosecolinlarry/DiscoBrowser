-- Update any titles of "bark" to "barks"
UPDATE dialogues
SET displayTitle = REPLACE(title, 'bark', 'barks')
WHERE (title LIKE '%bark%' AND title NOT LIKE '%barks%');

-- Update WCW to Working Class Woman
UPDATE dialogues
SET displayTitle = REPLACE(title, 'WCW', 'WORKING CLASS WOMAN')
WHERE title LIKE '%WCW%';

-- Remove ORB from titles, excluding things like "doorbell"
UPDATE dialogues
SET displayTitle = REPLACE(displayTitle, ' ORB', '')
WHERE title LIKE '% ORB %';

-- Hide obsolete conversations
UPDATE dialogues
SET isHidden = 1
WHERE description LIKE '%OBSOLETE%' OR title LIKE '%OBSOLETE%';