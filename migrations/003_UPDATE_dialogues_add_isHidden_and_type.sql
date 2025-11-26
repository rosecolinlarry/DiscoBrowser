DROP TABLE IF EXISTS orbs;
CREATE TABLE orbs (id INT PRIMARY KEY, title TEXT, description TEXT, actor INT DEFAULT 0, conversant INT DEFAULT 0, isHidden BOOL DEFAULT FALSE, type TEXT DEFAULT 'orb');

INSERT INTO orbs (id, title, description) -- Get ORB TEXT
SELECT id, title, description
FROM dialogues 
where dialogues.id in 
(SELECT distinct de1.conversationid FROM
    ( select count(*) as 'entrycount', conversationid
        from dentries
        group by conversationid) de1 -- Get number of dentries per convo, each convo has at least 2 entries -- 'START' and 'input()'
    left join dentries de2 on de1.conversationid = de2.conversationid
    where entrycount <= 2 -- no dialogue response options
) and description <> 0 and description is not '' and description is not null -- using description as replacement for dialogue text
and id not in (1157,1158,1051,905,487,486) -- marked for deletion in title
and id not in (1274,1275,494,1017) -- test convos/not in game
and (id in (1431,98,203,222,223,263,494,863,890,891,1009,1017) -- orbs with non-standard titles
    or title LIKE '% / %' or title LIKE '% ORB /%' or title LIKE '%ORB/%'); -- standard orb title format


DROP TABLE IF EXISTS tasks;
CREATE TABLE tasks (id INT PRIMARY KEY, title TEXT, description TEXT, actor INT DEFAULT 0, conversant INT DEFAULT 0, isHidden BOOL DEFAULT FALSE, type TEXT DEFAULT 'task');
INSERT INTO tasks (id, title, description) -- Get TASK text
SELECT id, title, description
FROM dialogues 
where dialogues.id in 
(SELECT distinct de1.conversationid FROM
    ( select count(*) as 'entrycount', conversationid
        from dentries
        group by conversationid) de1 -- Get number of dentries per convo, each convo has at least 2 entries -- 'START' and 'input()'
    left join dentries de2 on de1.conversationid = de2.conversationid
    where entrycount <= 2 -- no dialogue response options
) and description <> 0 and description is not '' and description is not null -- using description as replacement for dialogue text
and id not in (1157,1158,1051,905,487,486) -- marked for deletion in title
and id not in (1274,1275,494,1017) -- test convos/not in game
and not (id in (1431,98,203,222,223,263,494,863,890,891,1009,1017) -- orbs with non-standard titles
    or title LIKE '% / %' or title LIKE '% ORB /%' or title LIKE '%ORB/%'); -- standard orb title format
    
-- Add columns to existing dialogues table (if they don't exist, handle error manually)
ALTER TABLE dialogues ADD COLUMN isHidden BOOL DEFAULT FALSE;
ALTER TABLE dialogues ADD COLUMN type TEXT DEFAULT 'flow';

-- Update type for orbs
UPDATE dialogues
SET type = 'orb'
WHERE id IN (SELECT id FROM orbs);

-- Update type for tasks
UPDATE dialogues
SET type = 'task'
WHERE id IN (SELECT id FROM tasks);

-- Mark dialogues for deletion
UPDATE dialogues
SET isHidden = TRUE
WHERE id in (1157,1158,1051,905,487,486) -- marked for deletion in title
    or id in (1,2,3,4,1274,1275,494,1017); -- test convos/not in game
		
-- Cleanup temp tables
DROP TABLE orbs;
DROP TABLE tasks;