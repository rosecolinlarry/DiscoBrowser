-- Run these statements against your SQLite DB to add an FTS5 virtual table and populate it.

PRAGMA foreign_keys=OFF;

-- Create FTS5 table for searching dialoguetext and title
CREATE VIRTUAL TABLE IF NOT EXISTS fts_dentries USING fts5(dialoguetext, title, content='dentries', content_rowid='id');

-- Populate the FTS table from existing dentries
INSERT INTO fts_dentries(rowid, dialoguetext, title)
  SELECT id, dialoguetext, title FROM dentries;

-- Recommended indexes
CREATE INDEX IF NOT EXISTS idx_dentries_conversationid ON dentries(conversationid);
CREATE INDEX IF NOT EXISTS idx_dlinks_dest ON dlinks(destinationconversationid, destinationdialogueid);
CREATE INDEX IF NOT EXISTS idx_dlinks_origin ON dlinks(originconversationid, origindialogueid);
CREATE INDEX IF NOT EXISTS idx_alternates_conv_dialog ON alternates(conversationid, dialogueid);
CREATE INDEX IF NOT EXISTS idx_checks_conv_dialog ON checks(conversationid, dialogueid);
