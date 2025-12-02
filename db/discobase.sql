DROP TABLE IF EXISTS "meta";
CREATE TABLE "meta"
(
	"m_Name" TEXT DEFAULT null,
	"version" TEXT DEFAULT null,
	"author" TEXT DEFAULT null,
	"description" TEXT DEFAULT null,
	"globalUserScript" TEXT DEFAULT NULL
);

DROP TABLE IF EXISTS "actors";
CREATE TABLE "actors"
(
	"id" INT DEFAULT null,
	"name" TEXT DEFAULT null,
	"isPlayer" BOOL DEFAULT false,
	"description" TEXT DEFAULT null,
	"characterShortName" TEXT DEFAULT null,
	"isNPC" BOOL DEFAULT true,
	"shortDescription" TEXT DEFAULT null,
	"longDescription" TEXT DEFAULT null,
	"color" INT DEFAULT 0,
	"articyId" TEXT DEFAULT null,
	"pictures" TEXT DEFAULT null,
	"isFemale" BOOL DEFAULT null,
	"portrait" TEXT DEFAULT null,
	"spritePortrait" TEXT DEFAULT null,
	"alternatePortraits" TEXT DEFAULT null,
	"spritePortraits" TEXT DEFAULT null,
	"talkativeness" INT DEFAULT 0,
	"isHidden" BOOL DEFAULT FALSE,
	PRIMARY KEY("id")
);

DROP TABLE IF EXISTS "variables";
CREATE TABLE "variables"
(
	"id" INT,
	"name" TEXT DEFAULT null,
	"initialvalue" TEXT DEFAULT null,
	"description" TEXT DEFAULT null,
	PRIMARY KEY("id")
);

DROP TABLE IF EXISTS "conversations";
CREATE TABLE "conversations"
(
	"id" INT,
	"title" TEXT DEFAULT null,
	"articyId" TEXT DEFAULT null,
	"onUse" TEXT DEFAULT null,
	"overrideDialogueCondition" TEXT DEFAULT null,
	"alternateOrbText" TEXT DEFAULT null,
	"checkType" INT DEFAULT null,
	"condition" TEXT DEFAULT null,
	"instruction" TEXT DEFAULT null,
	"placement" TEXT DEFAULT null,
	"difficulty" INT DEFAULT null,
	"description" TEXT DEFAULT null,
	"actor" INT DEFAULT null,
	"conversant" INT DEFAULT null,
	"useOverrides" INT DEFAULT null,
	"overrideSubtitleSettings" BOOL DEFAULT null,
	"showNPCSubtitlesDuringLine" BOOL DEFAULT null,
	"showNPCSubtitlesWithResponses" BOOL DEFAULT null,
	"showPCSubtitlesDuringLine" BOOL DEFAULT null,
	"skipPCSubtitleAfterResponseMenu" BOOL DEFAULT null,
	"subtitleCharsPerSecond" NUMERIC DEFAULT null,
	"minSubtitleSeconds" NUMERIC DEFAULT null,
	"continueButton" BOOL DEFAULT null,
	"overrideSequenceSettings" BOOL DEFAULT null,
	"defaultSequence" TEXT DEFAULT null,
	"defaultPlayerSequence" TEXT DEFAULT null,
	"defaultResponseMenuSequence" TEXT DEFAULT null,
	"overrideInputSettings" INT DEFAULT null,
	"alwaysForceResponseMenu" INT DEFAULT null,
	"includeInvalidEntries" INT DEFAULT null,
	"responseTimeout" NUMERIC DEFAULT null,
	"nodeColor" TEXT DEFAULT null,
	"canvasScrollPositionX" NUMERIC DEFAULT null,
	"canvasScrollPositionY" NUMERIC DEFAULT null,
	"canvasZoom" NUMERIC DEFAULT null,
	"displayConditionMain" TEXT DEFAULT null,
	"doneConditionMain" TEXT DEFAULT null,
	"cancelConditionMain" TEXT DEFAULT null,
	"taskReward" TEXT DEFAULT null,
	"taskTimed" BOOL DEFAULT null,
	"type" TEXT DEFAULT "flow",
	"isHidden" BOOL DEFAULT FALSE,
	"totalEntries" INT DEFAULT NULL,
	"totalSubtasks" INT DEFAULT NULL,
	"isDeadEnd" BOOL DEFAULT NULL,
	"displayTitle" TEXT DEFAULT NULL,
	PRIMARY KEY("id"),
	FOREIGN KEY("actor") REFERENCES "actors"("id"),
	FOREIGN KEY("conversant") REFERENCES "actors"("id")
);

DROP TABLE IF EXISTS "items";
CREATE TABLE "items"
(
	"id" INT,
	"name" TEXT DEFAULT null,
	"isItem" BOOL DEFAULT null,
	"description" TEXT DEFAULT null,
	"characterShortName" TEXT DEFAULT null,
	"isCursed" BOOL DEFAULT null,
	"fixtureBonus" LONGTEXT DEFAULT null,
	"requirement" TEXT DEFAULT null,
	"bonus" TEXT DEFAULT null,
	"conversation" INT,
	"timeLeft" NUMERIC DEFAULT null,
	"thoughtType" INT DEFAULT null,
	"isThought" BOOL DEFAULT null,
	"fixtureDescription" TEXT DEFAULT null,
	"autoequip" BOOL DEFAULT null,
	"itemType" INT DEFAULT null,
	"isSubstance" BOOL DEFAULT null,
	"stackName" TEXT DEFAULT null,
	"sound" INT DEFAULT null,
	"isConsumable" BOOL DEFAULT null,
	"itemGroup" INT DEFAULT null,
	"equipOrb" TEXT DEFAULT null,
	"itemValue" NUMERIC DEFAULT null,
	"mediumTextValue" TEXT DEFAULT null,
	"multipleAllowed" BOOL DEFAULT null,
	"tooltip" TEXT DEFAULT null,
	"articyId" TEXT DEFAULT null,
	"isHidden" BOOL DEFAULT FALSE,
	PRIMARY KEY("id"),
	FOREIGN KEY("conversation") REFERENCES "conversations"("id")
);

DROP TABLE IF EXISTS "dentries";
CREATE TABLE "dentries"
(
	"id" INT DEFAULT null,
	"conversationid" INT DEFAULT null,
	"actor" INT DEFAULT null,
	"conversant" INT DEFAULT null,
	"delaySimStatus" NUMERIC DEFAULT null,
	"canvasRectX" NUMERIC DEFAULT null,
	"canvasRectY" NUMERIC DEFAULT null,
	"canvasRectWidth" NUMERIC DEFAULT null,
	"canvasRectHeight" NUMERIC DEFAULT null,
	"conditionPriority" INT DEFAULT null,
	"title" TEXT DEFAULT null,
	"dialoguetext" TEXT DEFAULT null,
	"articyId" TEXT DEFAULT null,
	"sequence" TEXT DEFAULT null,
	"dialogueEntryType" TEXT DEFAULT null,
	"menuText" TEXT DEFAULT null,
	"flagName" TEXT DEFAULT null,
	"outputId" TEXT DEFAULT null,
	"inputId" TEXT DEFAULT null,
	"isRoot" BOOL DEFAULT null,
	"isGroup" BOOL DEFAULT null,
	"forced" BOOL DEFAULT null,
	"alwaysPlayVoice" BOOL DEFAULT null,
	"playVoiceInPsychologicalMode" BOOL DEFAULT null,
	"nodeColor" TEXT DEFAULT null,
	"falseConditionAction" TEXT DEFAULT null,
	"userscript" TEXT DEFAULT null,
	"conditionstring" TEXT DEFAULT null,
	"totalAlternates" INT DEFAULT NULL,
	"totalChecks" INT DEFAULT NULL,
	"totalModifiers" INT DEFAULT NULL,
	"isHidden" BOOL DEFAULT FALSE,
	"displayTitle" TEXT DEFAULT NULL,
	PRIMARY KEY("conversationid","id"),
	FOREIGN KEY("actor") REFERENCES "actors"("id"),
	FOREIGN KEY("conversant") REFERENCES "actors"("id"),
	FOREIGN KEY("conversationid") REFERENCES "conversations"("id")
);

DROP TABLE IF EXISTS "dlinks";
CREATE TABLE "dlinks"
(
	"originconversationid" INT,
	"origindialogueid" INT DEFAULT null,
	"destinationconversationid" INT DEFAULT null,
	"destinationdialogueid" INT DEFAULT null,
	"isConnector" BOOL DEFAULT false,
	"priority" INT DEFAULT 2,
	FOREIGN KEY("destinationconversationid","destinationdialogueid") REFERENCES "dentries"("conversationid","id"),
	FOREIGN KEY("originconversationid","origindialogueid") REFERENCES "dentries"("conversationid","id")
);

DROP TABLE IF EXISTS "alternates";
CREATE TABLE "alternates"
(
	"id" INT,
	-- 1 to 4
	"conversationid" INT,
	"dialogueid" INT DEFAULT null,
	"condition" TEXT DEFAULT null,
	"alternateline" TEXT DEFAULT null,
	"replaces" TEXT DEFAULT null,
	PRIMARY KEY("conversationid","dialogueid","id"),
	FOREIGN KEY("conversationid","id") REFERENCES "dentries"("conversationid","id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS "modifiers";
CREATE TABLE "modifiers"
(
	"id" INT,
	-- 1 to 10
	"conversationid" INT,
	"dialogueid" INT DEFAULT null,
	"modifier" INT,
	"variable" INT,
	"tooltip" TEXT DEFAULT NULL,
	PRIMARY KEY("conversationid","dialogueid","id"),
	FOREIGN KEY("conversationid","id") REFERENCES "dentries"("conversationid","id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS "checks";
CREATE TABLE "checks"
(
	"conversationid" INT,
	"dialogueid" INT DEFAULT null,
	"checktype" TEXT DEFAULT null,
	-- Pass = Passive, White, Red
	"skilltype" TEXT DEFAULT null,
	-- Fysique, Endurance, etc
	"check_target" TEXT DEFAULT null,
	"difficulty" INT DEFAULT null,
	PRIMARY KEY("conversationid","dialogueid"),
	FOREIGN KEY("conversationid","dialogueid") REFERENCES "dentries"("conversationid","id") ON DELETE CASCADE
);

DROP TABLE IF EXISTS "subtasks";
CREATE TABLE "subtasks"
(
	"conversationid" INT,
	"id" INT DEFAULT null,
	"name" TEXT DEFAULT null,
	"isTimed" BOOL DEFAULT null,
	"displayCondition" TEXT DEFAULT null,
	"doneCondition" TEXT DEFAULT null,
	"cancelCondition" TEXT DEFAULT null,
	"isHidden" BOOL DEFAULT FALSE,
	PRIMARY KEY("conversationid","id"),
	FOREIGN KEY("conversationid") REFERENCES "conversations"("id")
);

DROP INDEX IF EXISTS "idx_dentry_conversation";
CREATE INDEX "idx_dentry_conversation" ON "dentries"("conversationid");

DROP INDEX IF EXISTS "idx_dentry_actor";
CREATE INDEX "idx_dentry_actor" ON "dentries"("actor");

DROP INDEX IF EXISTS "idx_dentry_conversant";
CREATE INDEX "idx_dentry_conversant" ON "dentries"("conversant");

DROP INDEX IF EXISTS "idx_dlinks_origin";
CREATE INDEX "idx_dlinks_origin" ON "dlinks"("originconversationid","origindialogueid");

DROP INDEX IF EXISTS "idx_dlinks_dest";
CREATE INDEX "idx_dlinks_dest" ON "dlinks"("destinationconversationid","destinationdialogueid");