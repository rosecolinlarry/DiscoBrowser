-- Replace empty titles with <actor name>: <dialogue text>, with
-- dialogue text trimmed to 36 char and appended with "..."
-- to match the format of the original database
DROP TABLE IF EXISTS temp_dentries;
CREATE TABLE temp_dentries (id INT, title TEXT, dialoguetext TEXT, actor INT, conversant INT, conversationid INT, difficultypass INT DEFAULT 0, isgroup BOOL, hascheck BOOL DEFAULT false, sequence TEXT, hasalts BOOL DEFAULT false, conditionstring TEXT, userscript TEXT, FOREIGN KEY (conversationid) REFERENCES dialogues(id), FOREIGN KEY (actor) REFERENCES actors(id), FOREIGN KEY (conversant) REFERENCES actors(id), PRIMARY KEY(conversationid,id));

INSERT INTO temp_dentries (id, conversationid, title)
SELECT id, conversationid, title
	FROM 
	(SELECT dentries.id as 'id', dentries.conversationid as 'conversationid', CONCAT(actors.name, CASE
		WHEN LENGTH(dentries.dialoguetext) > 39 THEN CONCAT(': "',SUBSTR(dentries.dialoguetext, 1, 39 - 3) || '..."')
		WHEN dentries.dialoguetext LIKE '' OR dentries.dialoguetext IS NULL THEN ''
		ELSE CONCAT(': "', dentries.dialoguetext, '"')
		END) AS 'title'
	FROM dentries
	LEFT JOIN dialogues ON dentries.conversationid = dialogues.id
	LEFT JOIN actors ON actors.id = dentries.actor
	WHERE dentries.title LIKE '' OR dentries.title IS NULL);
	

UPDATE dentries SET title = (SELECT title FROM temp_dentries WHERE dentries.id = temp_dentries.id AND dentries.conversationid = temp_dentries.conversationid) WHERE dentries.title LIKE '' OR dentries.title IS NULL;
DROP TABLE temp_dentries;