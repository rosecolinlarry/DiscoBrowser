// db.js
// Wraps sql.js Database and provides helper methods, search, and simple caching.

let _db = null;
let SQL = null;

const allowedWordBarriers = [
  "'",
  '"',
  "\\",
  "//",
  " ",
  ".",
  "!",
  "?",
  "$",
  "#",
  ">",
  "*",
  ":",
  "_",
  "(",
  ")",
  "[",
  "]",
  "--",
  "",
];

export async function initDatabase(sqlFactory, path = "db/discobase.sqlite3") {
  SQL = sqlFactory;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    _db = new SQL.Database(new Uint8Array(buffer));
  } catch (err) {
    console.error("initDatabase error", err);
    throw err;
  }
}

function run(sql) {
  if (!_db) throw new Error("DB not initialized");
  return _db.exec(sql);
}

/* Minimal safe helper for retrieving rows */
export function execRows(sql) {
  const res = run(sql);
  if (!res || !res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map((v) => {
    const o = Object.create(null);
    for (let i = 0; i < cols.length; i++) o[cols[i]] = v[i];
    return o;
  });
}

export function execRowsFirstOrDefault(sql) {
  // Remove last character if semicolon
  if (sql?.at(-1) === ";") {
    sql = sql.slice(0, -1);
  }
  sql += " LIMIT 1;";
  const values = execRows(sql);
  if (values && values.length > 0) {
    return values[0];
  }
  return null;
}

/* Prepared statement helper (for repeated queries) */
export function prepareAndAll(stmtSql, params = []) {
  if (!_db) throw new Error("DB not initialized");
  const stmt = _db.prepare(stmtSql);
  const out = [];
  try {
    stmt.bind(params);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      out.push(row);
    }
  } finally {
    stmt.free();
  }
  return out;
}


// #region Actors
export function getDistinctActors() {
  return execRows(
    `SELECT DISTINCT id, name FROM actors WHERE name IS NOT NULL AND name != '' ORDER BY name;`
  );
}

export function getActorNameById(actorId) {
  if (!actorId || actorId === 0) {
    return "";
  }
  const actor = execRowsFirstOrDefault(
    `SELECT id, name, color
        FROM actors
        WHERE id='${actorId}'`
  );
  return actor;
}
// #endregion

// #region Conversations
export function getConversationById(convoId, showHidden) {
  // Get the conversation's task related fields
  let convoSQL = `SELECT  
      id, title, onUse, overrideDialogueCondition, alternateOrbText
      , checkType, condition, instruction
      , placement, difficulty, description, actor, conversant
      , displayConditionMain, doneConditionMain, cancelConditionMain, taskReward, taskTimed
      , type, isHidden, totalEntries, totalSubtasks
    FROM conversations WHERE `;
  if (!showHidden) {
    convoSQL += "isHidden != 1 AND ";
  }
  convoSQL += `id=${convoId}`;
  if (convoId) {
    return execRowsFirstOrDefault(convoSQL);
  }
}
/* Conversations list */
export function getAllConversations(showHidden) {
  let q = `SELECT id, title, type FROM conversations `;
  if (!showHidden) {
    q += `WHERE isHidden != 1 `;
  }
  q += `ORDER BY title;`;
  return execRows(q);
}
// #endregion

// #region Entries
/* Load dentries for a conversation (summary listing) */
export function getEntriesForConversation(convoId, showHidden) {
  if (showHidden) {
    return execRows(`
    SELECT id, title, dialoguetext, actor, isHidden
      FROM dentries
      WHERE conversationid=${convoId}
      ORDER BY id;
  `);
  } else {
    return execRows(`
    SELECT id, title, dialoguetext, actor, isHidden
      FROM dentries
      WHERE conversationid=${convoId} AND isHidden != 1
      ORDER BY id;
  `);
  }
}

/* Fetch a single entry row (core fields) */
export function getEntry(convoId, entryId) {
  return execRowsFirstOrDefault(
    `SELECT de.id, de.title, de.dialoguetext, de.actor, de.hasCheck,de.hasAlts
    , de.sequence, de.conditionstring, de.userscript, de.isHidden, c.difficulty as difficultypass
          FROM dentries de
        LEFT JOIN checks c ON c.dialogueid = de.id AND c.conversationid = de.conversationid
        LEFT JOIN modifiers m ON m.dialogueid = de.id AND m.conversationid = de.conversationid
        LEFT JOIN alternates a ON a.dialogueid = de.id AND a.conversationid = de.conversationid
          WHERE de.conversationid=${convoId} 
          AND de.id=${entryId}`
  );
}

/* Fetch alternates for an entry */
export function getAlternates(convoId, entryId) {
  return execRows(
    `SELECT conversationid, dialogueid, alternateline, condition 
      FROM alternates 
      WHERE conversationid=${convoId} 
      AND dialogueid=${entryId};`
  );
}

/* Fetch check(s) for an entry */
export function getChecks(convoId, entryId) {
  return execRows(
    `SELECT checktype, difficulty, flagName, forced, a.name
      FROM checks c
	    LEFT JOIN dentries d ON c.dialogueid = d.id AND c.conversationid = d.conversationid
	    LEFT JOIN actors a ON a.articyId = c.skilltype
      WHERE conversationid=${convoId} 
      AND dialogueid=${entryId};`
  );
}

/* Fetch parents and children dlinks for an entry */
export function getParentsChildren(convoId, entryId) {
  const parents = execRows(`
    SELECT originconversationid AS o_convo, origindialogueid AS o_id, priority, isConnector
      FROM dlinks
      WHERE destinationconversationid=${convoId} 
      AND destinationdialogueid=${entryId};
  `);
  const children = execRows(`
    SELECT destinationconversationid AS d_convo, destinationdialogueid AS d_id, priority, isConnector
      FROM dlinks
      WHERE originconversationid=${convoId} 
      AND origindialogueid=${entryId};
  `);
  return { parents, children };
}

/* Fetch destination entries batched (for link lists) */
export function getEntriesBulk(pairs = [], showHidden) {
  // pairs = [{convo, id}, ...] -> batch by convo to use IN
  if (!pairs.length) return [];
  const groupByConvoId = new Map();
  for (const p of pairs) {
    const entryIds = groupByConvoId.get(p.convoId) || [];
    entryIds.push(p.entryId);
    groupByConvoId.set(p.convoId, entryIds);
  }
  const results = [];
  for (const [convoId, entryIds] of groupByConvoId.entries()) {
    const entryIdList = entryIds.map((i) => String(i)).join(",");

    let query =
      "SELECT id, title, dialoguetext, actor, isHidden FROM dentries ";
    query += `WHERE conversationId=${convoId} `;
    if (!showHidden) {
      query += `AND isHidden != 1 `;
    }

    query += `AND id IN (${entryIdList});`;

    const rows = execRows(query);

    rows.forEach((r) => {
      results.push({
        convo: convoId,
        id: r.id,
        title: r.title, // Populates Next Dialogue Options title
        dialoguetext: r.dialoguetext,
        actor: r.actor,
      });
    });
  }
  return results;
}
// #endregion

// #region Search
/** Search entry dialogues and conversation dialogues */
export function searchDialogues(
  q,
  limit = 1000,
  actorIds = null,
  filterStartInput = true,
  offset = 0,
  conversationIds = null,
  showHidden
) {
  const raw = (q || "").trim();

  // Extract Variable["..."] / Variable['...'] tokens so internal quotes don't break parsing
  const variableTokens = [];
  const variableTokenRegex = /Variable\[\s*(['"])(.*?)\1\s*\]/g;
  let vmatch;
  while ((vmatch = variableTokenRegex.exec(raw)) !== null) {
    variableTokens.push(vmatch[0]);
  }

  // Extract simple function-like tokens (e.g., CheckItem("x"), HasShirt(), once(1), CheckEquipped('y'))
  const functionTokens = [];
  const functionTokenRegex = /\b[A-Za-z_][A-Za-z0-9_]*\([^)]*\)/g;
  let fmatch;
  while ((fmatch = functionTokenRegex.exec(raw)) !== null) {
    functionTokens.push(fmatch[0]);
  }

  // Remove variable and function tokens from the string we parse for quoted phrases / words
  const processedRaw = raw
    .replace(variableTokenRegex, " ")
    .replace(functionTokenRegex, " ")
    .trim();

  // Parse query for quoted phrases and regular words from the processed raw string
  const quotedPhrases = [];
  const quotedPhrasesRegex = /"([^"]+)"/g;
  let match;
  while ((match = quotedPhrasesRegex.exec(processedRaw)) !== null) {
    quotedPhrases.push(match[1]);
  }

  // Remove quoted phrases from processedRaw to get remaining words
  const remainingText = processedRaw.replace(/"[^\"]+"/g, "").trim();
  const words = remainingText ? remainingText.split(/\s+/) : [];

  // Build WHERE clause - only include text search if query is provided
  let where = "";

  // Helper: escape single quotes
  function esc(s) {
    return s.replace(/'/g, "''");
  }

  // Helper: build conditions for a set of columns using parsed tokens
  function buildConditionsForColumns(columns) {
    const conds = [];

    // quoted phrases
    quotedPhrases.forEach((phrase) => {
      const safe = esc(phrase);
      conds.push(
        `(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`
      );
    });

    // variables
    variableTokens.forEach((token) => {
      const safe = esc(token);
      conds.push(
        `(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`
      );
    });

    // functions
    functionTokens.forEach((token) => {
      const safe = esc(token);
      conds.push(
        `(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`
      );
    });

    // words (wholeWords filtered on front end)
    words.forEach((word) => {
      const safe = esc(word);
      conds.push(
        `(${columns.map((c) => `${c} LIKE '%${safe}%'`).join(" OR ")})`
      );
    });

    return conds;
  }

  // Build dentries WHERE clause using shared helper
  if (
    quotedPhrases.length > 0 ||
    words.length > 0 ||
    variableTokens.length > 0 ||
    functionTokens.length > 0
  ) {
    const conditions = buildConditionsForColumns(["dialoguetext", "title"]);
    if (conditions.length > 0) {
      where = conditions.join(" AND ");
    }
  }

  // Handle multiple actor IDs
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map((id) => `'${id}'`).join(",");
      const actorFilter = `actor IN (${actorList})`;
      where = where ? `${where} AND ${actorFilter}` : actorFilter;
    } else if (typeof actorIds === "string" || typeof actorIds === "number") {
      // Legacy support for single actor ID
      const actorFilter = `actor='${actorIds}'`;
      where = where ? `${where} AND ${actorFilter}` : actorFilter;
    }
  }

  // Handle multiple conversation IDs
  if (conversationIds) {
    if (Array.isArray(conversationIds) && conversationIds.length > 0) {
      const convoList = conversationIds.map((id) => `'${id}'`).join(",");
      const convoFilter = `conversationid IN (${convoList})`;
      where = where ? `${where} AND ${convoFilter}` : convoFilter;
    }
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

  const limitClause = ` LIMIT ${limit} OFFSET ${offset}`;

  // Get total counts first (without limit/offset)
  const dentriesCountSQL = `SELECT COUNT(*) as count FROM dentries WHERE ${where};`;
  const dentriesCount = execRowsFirstOrDefault(dentriesCountSQL)?.count || 0;

  // Search dentries for flow conversations
  const dentriesSQL = `
    SELECT conversationid, id, dialoguetext, title, actor, isHidden 
      FROM dentries 
      WHERE ${where} 
      ORDER BY conversationid, id 
      ${limitClause};`;
  const dentriesResults = execRows(dentriesSQL);

  // Also search dialogues table for orbs and tasks (they use description as dialogue text)
  let dialoguesWhere = "";

  // Build dialogues WHERE clause using shared helper
  if (
    quotedPhrases.length > 0 ||
    words.length > 0 ||
    variableTokens.length > 0 ||
    functionTokens.length > 0
  ) {
    const dialoguesConditions = buildConditionsForColumns([
      "description",
      "title",
    ]);
    if (dialoguesConditions.length > 0) {
      dialoguesWhere = `${dialoguesConditions.join(" AND ")}`;
    }
  }

  // Handle multiple actor IDs for dialogues
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map((id) => `'${id}'`).join(",");
      // For orbs and tasks, check both actor and conversant fields
      // Always include actor/conversant = 0 (unassigned orbs/tasks)
      const actorFilter = `(actor IN (${actorList}, '0') OR conversant IN (${actorList}, '0'))`;
      dialoguesWhere = dialoguesWhere
        ? `${dialoguesWhere} AND ${actorFilter}`
        : actorFilter;
    } else if (typeof actorIds === "string" || typeof actorIds === "number") {
      const actorFilter = `(actor='${actorIds}' OR conversant='${actorIds}' OR actor='0' OR conversant='0')`;
      dialoguesWhere = dialoguesWhere
        ? `${dialoguesWhere} AND ${actorFilter}`
        : actorFilter;
    }
  }

  // Handle conversation IDs for dialogues (orbs/tasks use id as conversationid)
  if (
    conversationIds &&
    Array.isArray(conversationIds) &&
    conversationIds.length > 0
  ) {
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

  // Get count for dialogues
  const dialoguesCountSQL = `SELECT COUNT(*) as count FROM conversations WHERE ${dialoguesWhere};`;
  const dialoguesCount = execRowsFirstOrDefault(dialoguesCountSQL)?.count || 0;

  const dialoguesSQL = `
    SELECT id as conversationid, null as id, description as dialoguetext, title, actor, isHidden 
      FROM conversations 
      WHERE ${dialoguesWhere} 
      ORDER BY id 
      ${limitClause};`;
  const dialoguesResults = execRows(dialoguesSQL);

  // Also search alternates table for alternate dialogue lines
  let alternatesWhere = "";

  if (
    quotedPhrases.length > 0 ||
    words.length > 0 ||
    variableTokens.length > 0 ||
    functionTokens.length > 0
  ) {
    const alternatesConditions = buildConditionsForColumns(["alternateline"]);
    alternatesWhere = alternatesConditions.join(" AND ");
  }

  // Handle multiple actor IDs for alternates (join with dentries to get actor)
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map((id) => `'${id}'`).join(",");
      const actorFilter = `d.actor IN (${actorList})`;
      alternatesWhere = alternatesWhere
        ? `${alternatesWhere} AND ${actorFilter}`
        : actorFilter;
    } else if (typeof actorIds === "string" || typeof actorIds === "number") {
      const actorFilter = `d.actor='${actorIds}'`;
      alternatesWhere = alternatesWhere
        ? `${alternatesWhere} AND ${actorFilter}`
        : actorFilter;
    }
  }

  // Handle conversation IDs for alternates
  if (
    conversationIds &&
    Array.isArray(conversationIds) &&
    conversationIds.length > 0
  ) {
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

  // Calculate total count
  const totalCount = dentriesCount + dialoguesCount + alternatesCount;

  // Combine results
  return {
    results: [...dentriesResults, ...dialoguesResults, ...alternatesResults],
    total: totalCount,
  };
}
// #endregion