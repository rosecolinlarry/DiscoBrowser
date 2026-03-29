import { execRows, execRowsFirstOrDefault } from "./sqlHelpers.js";

export function searchDialogues(
  q,
  limit = 1000,
  actorIds = null,
  filterStartInput = true,
  offset = 0,
  conversationIds = null,
  showHidden) {
  // Search dentries table
  const limitClause = ` LIMIT ${limit} OFFSET ${offset}`;

  let dentriesWhere = "";
  dentriesWhere = buildEntriesWhereAndLimitClause(
    q,
    dentriesWhere,
    actorIds,
    conversationIds,
    filterStartInput,
    showHidden
  );
  const { dentriesCount, dentriesResults } = getEntries(
    dentriesWhere,
    limitClause
  );

  // Search dialogues table
  let dialoguesWhere = buildDialoguesWhereClause(
    q,
    actorIds,
    conversationIds,
    showHidden
  );
  const { dialoguesCount, dialoguesResults } = getDialogues(
    dialoguesWhere,
    limitClause
  );

  // Search alternates table
  let alternatesWhere = buildAlternatesWhereClause(
    q,
    actorIds,
    conversationIds,
    filterStartInput
  );
  let { alternatesCount, alternatesResults } = getAlternateLines(
    alternatesWhere,
    limitClause
  );

  // Calculate total count
  const totalCount = dentriesCount + dialoguesCount + alternatesCount;

  // Combine results
  return {
    results: [...dentriesResults, ...dialoguesResults, ...alternatesResults],
    total: totalCount,
  };
}
function esc(s) {
  // Escape single quotes
  return s.replace(/'/g, "''");
}
function buildConditionsForColumns(q, columns) {
  // Build conditions for a set of columns using parsed tokens
  const raw = (q || "").trim();
  const { variableTokenRegex, variableTokens } = extractVariableTokens(raw);
  const { functionTokenRegex, functionTokens } = extractFunctionTokens(raw);

  // Remove variable and function tokens from the string we parse for quoted phrases / words
  const processedRaw = raw
    .replace(variableTokenRegex, " ")
    .replace(functionTokenRegex, " ")
    .trim();

  const quotedPhrases = extractQuotedPhrases(processedRaw);

  // Remove quoted phrases from processedRaw to get remaining words
  const remainingText = processedRaw.replace(/"[^"]+"/g, "").trim();
  const words = remainingText ? remainingText.split(/\s+/) : [];

  const conds = [];

  // quoted phrases
  quotedPhrases.forEach((phrase) => {
    const safe = esc(phrase);
    conds.push(`(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`);
  });

  // variables
  variableTokens.forEach((token) => {
    const safe = esc(token);
    conds.push(`(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`);
  });

  // functions
  functionTokens.forEach((token) => {
    const safe = esc(token);
    conds.push(`(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`);
  });

  // words (wholeWords filtered on front end)
  words.forEach((word) => {
    const safe = esc(word);
    conds.push(`(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`);
  });
  if (quotedPhrases.length > 0 ||
    variableTokens.length > 0 ||
    functionTokens.length > 0 ||
    words.length > 0) {
    return conds;
  }
  return null;
}
function extractQuotedPhrases(processedRaw) {
  // Parse query for quoted phrases and regular words from the processed raw string
  const quotedPhrases = [];
  const quotedPhrasesRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedPhrasesRegex.exec(processedRaw)) !== null) {
    quotedPhrases.push(match[1]);
  }
  return quotedPhrases;
}
function extractFunctionTokens(raw) {
  // Extract simple function-like tokens (e.g., CheckItem("x"), HasShirt(), once(1), CheckEquipped('y'))
  const functionTokens = [];
  const functionTokenRegex = /\b[A-Za-z_][A-Za-z0-9_]*\([^)]*\)/g;
  let fmatch;
  while ((fmatch = functionTokenRegex.exec(raw)) !== null) {
    functionTokens.push(fmatch[0]);
  }
  return { functionTokenRegex, functionTokens };
}
function extractVariableTokens(raw) {
  // Extract Variable["..."] / Variable['...'] tokens so internal quotes don't break parsing
  const variableTokens = [];
  const variableTokenRegex = /Variable\[\s*(['"])(.*?)\1\s*\]/g;
  let vmatch;
  while ((vmatch = variableTokenRegex.exec(raw)) !== null) {
    variableTokens.push(vmatch[0]);
  }
  return { variableTokenRegex, variableTokens };
}
function buildAlternatesWhereClause(
  q,
  actorIds,
  conversationIds,
  filterStartInput
) {
  let alternatesWhere = "";

  const alternatesConditions = buildConditionsForColumns(q, ["alternateline"]);
  if (alternatesConditions?.length > 0) {
    alternatesWhere = alternatesConditions?.join(" AND ");
  }

  // Handle multiple actor IDs for alternates (join with dentries to get actor)
  if (actorIds && Array.isArray(actorIds) && actorIds.length > 0) {
    const actorList = actorIds.map((id) => `'${id}'`).join(",");
    const actorFilter = `d.actor IN (${actorList})`;
    alternatesWhere = alternatesWhere
      ? `${alternatesWhere} AND ${actorFilter}`
      : actorFilter;
  }

  // Handle conversation IDs for alternates
  if (conversationIds &&
    Array.isArray(conversationIds) &&
    conversationIds.length > 0) {
    const convoList = conversationIds.map((id) => `'${id}'`).join(",");
    const convoFilter = `a.conversationid IN (${convoList})`;
    alternatesWhere = alternatesWhere
      ? `${alternatesWhere} AND ${convoFilter}`
      : convoFilter;
  }

  if (filterStartInput && alternatesWhere) {
    alternatesWhere += ` AND a.dialogueid NOT IN (0, 1)`;
  } else if (filterStartInput) {
    alternatesWhere = `a.dialogueid NOT IN (0, 1)`;
  }
  return alternatesWhere;
}
function buildEntriesWhereAndLimitClause(
  q,
  where,
  actorIds,
  conversationIds,
  filterStartInput,
  showHidden
) {
  const conditions = buildConditionsForColumns(q, ["dialoguetext", "title"]);
  if (conditions?.length > 0) {
    where = conditions.join(" AND ");
  }

  // Handle multiple actor IDs
  if (actorIds && Array.isArray(actorIds) && actorIds.length > 0) {
    const actorList = actorIds.map((id) => `'${id}'`).join(",");
    const actorFilter = `actor IN (${actorList})`;
    where = where ? `${where} AND ${actorFilter}` : actorFilter;
  }

  // Handle multiple conversation IDs
  if (conversationIds &&
    Array.isArray(conversationIds) &&
    conversationIds.length > 0) {
    const convoList = conversationIds.map((id) => `'${id}'`).join(",");
    const convoFilter = `conversationid IN (${convoList})`;
    where = where ? `${where} AND ${convoFilter}` : convoFilter;
  }

  // Build filter for start input if needed
  const startFilter = filterStartInput ? `id NOT IN (0, 1)` : "";

  // Combine WHERE clause
  if (startFilter) {
    where = where ? `${where} AND ${startFilter}` : startFilter;
  }

  // Hide hidden dialogues
  if (!showHidden) {
    const hideHiddenFilter = "isHidden != 1";
    where = where ? `${where} AND ${hideHiddenFilter}` : hideHiddenFilter;
  }

  // If still no where clause, default to all (except start input if filtered)
  if (!where) {
    where = "1=1";
  }

  return where;
}
function buildDialoguesWhereClause(q, actorIds, conversationIds, showHidden) {
  // Also search dialogues table for orbs and tasks (they use description as dialogue text)
  let dialoguesWhere = "";

  // Build dialogues WHERE clause using shared helper
  const dialoguesConditions = buildConditionsForColumns(q, [
    "description",
    "title",
  ]);
  if (dialoguesConditions?.length > 0) {
    dialoguesWhere = `${dialoguesConditions.join(" AND ")}`;
  }

  // Handle multiple actor IDs for dialogues
  if (actorIds && Array.isArray(actorIds) && actorIds.length > 0) {
    const actorList = actorIds.map((id) => `'${id}'`).join(",");
    // For orbs and tasks, check both actor and conversant fields
    // Always include actor/conversant = 0 (unassigned orbs/tasks)
    const actorFilter = `(actor IN (${actorList}, '0') OR conversant IN (${actorList}, '0'))`;
    dialoguesWhere = dialoguesWhere
      ? `${dialoguesWhere} AND ${actorFilter}`
      : actorFilter;
  }

  // Handle conversation IDs for dialogues (orbs/tasks use id as conversationid)
  if (conversationIds &&
    Array.isArray(conversationIds) &&
    conversationIds.length > 0) {
    const convoList = conversationIds.map((id) => `'${id}'`).join(",");
    const convoFilter = `id IN (${convoList})`;
    dialoguesWhere = dialoguesWhere
      ? `${dialoguesWhere} AND ${convoFilter}`
      : convoFilter;
  }

  if (!showHidden) {
    const hideHiddenFilter = "isHidden != 1";
    dialoguesWhere = dialoguesWhere
      ? `${dialoguesWhere} AND ${hideHiddenFilter}`
      : hideHiddenFilter;
  }

  // If still no dialoguesWhere, default to all
  if (!dialoguesWhere) {
    dialoguesWhere = "1=1";
  }
  return dialoguesWhere;
}
function getEntries(where, limitClause) {
  const dentriesCountSQL = `SELECT COUNT(*) as count FROM dentries WHERE ${where};`;

  // Search dentries for flow conversations
  const dentriesSQL = `
    SELECT conversationid, id, dialoguetext, title, actor, isHidden 
      FROM dentries 
      WHERE ${where} 
      ORDER BY conversationid, id 
      ${limitClause};`;
  const dentriesResults = execRows(dentriesSQL);
  const dentriesCount = execRowsFirstOrDefault(dentriesCountSQL)?.count || 0;
  return { dentriesCount, dentriesResults };
}
function getDialogues(dialoguesWhere, limitClause) {
  const dialoguesCountSQL = `SELECT COUNT(*) as count FROM conversations WHERE ${dialoguesWhere};`;
  const dialoguesCount = execRowsFirstOrDefault(dialoguesCountSQL)?.count || 0;

  const dialoguesSQL = `
    SELECT id as conversationid, null as id, description as dialoguetext, title, actor, isHidden 
      FROM conversations 
      WHERE ${dialoguesWhere} 
      ORDER BY id 
      ${limitClause};`;
  const dialoguesResults = execRows(dialoguesSQL);
  return { dialoguesCount, dialoguesResults };
}
function getAlternateLines(alternatesWhere, limitClause) {
  // Only query alternates if we have search criteria
  let alternatesResults = [];
  let alternatesCount = 0;
  if (alternatesWhere) {
    // Get count for alternates
    const alternatesCountSQL = `
      SELECT COUNT(*) as count FROM alternates a
      JOIN dentries d ON a.conversationid = d.conversationid AND a.dialogueid = d.id
      WHERE ${alternatesWhere};`;
    alternatesCount = execRowsFirstOrDefault(alternatesCountSQL)?.count || 0;

    const alternatesSQL = `
      SELECT a.conversationid, a.dialogueid as id, a.alternateline as dialoguetext, d.title, d.actor, a.condition as alternatecondition
        FROM alternates a
        JOIN dentries d ON a.conversationid = d.conversationid AND a.dialogueid = d.id
        WHERE ${alternatesWhere} 
        ORDER BY a.conversationid, a.dialogueid 
        ${limitClause};`;
    alternatesResults = execRows(alternatesSQL).map((r) => ({
      ...r,
      isAlternate: true,
    }));
  }
  return { alternatesCount, alternatesResults };
}
