-- Hide entries for hidden conversations
UPDATE dentries 
SET isHidden = 1
WHERE dentries.conversationid IN (SELECT id FROM conversations WHERE isHidden = 1)
AND isHidden = 0