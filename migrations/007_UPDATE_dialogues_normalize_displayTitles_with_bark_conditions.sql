-- Remove barks from title and rearrance into common format <loc> / <subj> / <condition>
DROP TABLE IF EXISTS dialoguesTemp;
CREATE TABLE dialoguesTemp (id INT PRIMARY KEY, location TEXT, subject TEXT, condition TEXT, displayTitle TEXT);

INSERT INTO dialoguesTemp (id, location, subject, condition)
SELECT id
, TRIM(substr(displayTitle, 1, INSTR(displayTitle, ' / ') - 1)) AS 'location'
, TRIM(REPLACE(REPLACE(SUBSTR(displayTitle, INSTR(displayTitle, ' / ') + LENGTH(' / ')), ' barks', '') , substr(displayTitle, INSTR(displayTitle, 'barks') + LENGTH('barks')), '')) AS 'subject'
, TRIM(substr(displayTitle, INSTR(displayTitle, 'barks') + LENGTH('barks'))) AS 'condition'
FROM dialogues
WHERE displayTitle LIKE '%barks%' 
AND INSTR(displayTitle, 'barks') > 0
AND INSTR(displayTitle, ' / ') > 0 
AND LENGTH(substr(displayTitle, INSTR(displayTitle, 'barks') + LENGTH('barks'))) > 0;

UPDATE dialoguesTemp
SET displayTitle = CONCAT(location, ' / ', subject, ' / ', condition);

UPDATE dialogues
SET displayTitle = (SELECT dialoguesTemp.displayTitle FROM dialoguesTemp WHERE dialogues.id = dialoguesTemp.id);

DROP TABLE dialoguesTemp;