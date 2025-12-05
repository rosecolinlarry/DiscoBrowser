-- Hide dialogue-less flow conversations
UPDATE conversations 
SET isHidden = 1
WHERE isDeadEnd = 1
and isHidden = 0
and type <> 'orb' 
and type <> 'task';

-- Hide unfinished or test items manually
UPDATE conversations
SET isHidden = 1
WHERE (id = 1470 and title = 'Coop TEST')
OR (id = 905 and title = 'unfinished orb')
OR (id = 270 and title = 'TEST / END TITLES TEST FOR ROZZO');