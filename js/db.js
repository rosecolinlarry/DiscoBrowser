// db.js
// Wraps sql.js Database and provides helper methods, search, and simple caching.

let _db = null;
let SQL = null;

const entryCache = new Map();

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
  if(sql?.at(-1) === ";") {
    sql = sql.slice(0, -1) 
  }
  sql += ' LIMIT 1;'
  const values = execRows(sql);
  if(values && values.length > 0) {
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

/* Conversations list */
export function getAllConversations() {
  return execRows(`SELECT id, title, type FROM dialogues WHERE isHidden == 0 ORDER BY title;`);
}

/* Actors */
export function getDistinctActors() {
  return execRows(`SELECT DISTINCT id, name FROM actors WHERE name IS NOT NULL AND name != '' ORDER BY name;`);
}

export function getActorNameById(actorId) {
  if (!actorId || actorId === 0) {
    return "";
  }
  const actor = execRowsFirstOrDefault(
    `SELECT id, name
        FROM actors
        WHERE id='${actorId}'`
  );
  return actor?.name;
}

export function getConversationById(convoId) {
  if(convoId) {
    return execRowsFirstOrDefault(
      `SELECT id, title, description, actor, conversant, type 
        FROM dialogues 
        WHERE id='${convoId}';`
    )
  }
}

/* Load dentries for a conversation (summary listing) */
export function getEntriesForConversation(convoId) {
  return execRows(`
    SELECT id, title, dialoguetext, actor
      FROM dentries
      WHERE conversationid='${convoId}'
      ORDER BY id;
  `);
}

/* Fetch a single entry row (core fields) */
export function getEntry(convoId, entryId) {
  return execRowsFirstOrDefault(
    `SELECT id, title, dialoguetext, actor, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass 
      FROM dentries 
      WHERE conversationid='${convoId}' 
      AND id='${entryId}'`
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
    `SELECT isred, difficulty, flagname, forced, skilltype 
      FROM checks 
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
export function getEntriesBulk(pairs = []) {
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
    const rows = execRows(
      `SELECT id, title, dialoguetext, actor 
        FROM dentries 
        WHERE conversationid='${convoId}' 
        AND id IN (${entryIdList});`
    );
    rows.forEach((r) => {
      results.push({
        convo: convoId,
        id: r.id,
        title: r.title,
        dialoguetext: r.dialoguetext,
        actor: r.actor,
      });
    });
  }
  return results;
}

/** Search entry dialogues and conversation dialogues (orbs/tasks) */
export function searchDialogues(q, minLength = 3, limit = 1000, actorIds = null, filterStartInput = true, offset = 0) {
  const raw = (q || "").trim();
  
  // Make a SQL-safe single-quoted literal (basic)
  const safe = raw.replace(/'/g, "''");

  // Build WHERE clause - only include text search if query is provided
  let where = "";
  if (raw) {
    where = `(dialoguetext LIKE '%${safe}%' OR title LIKE '%${safe}%')`;
  }
  
  // Handle multiple actor IDs
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map(id => `'${id}'`).join(',');
      const actorFilter = `actor IN (${actorList})`;
      where = where ? `${where} AND ${actorFilter}` : actorFilter;
    } else if (typeof actorIds === 'string' || typeof actorIds === 'number') {
      // Legacy support for single actor ID
      const actorFilter = `actor='${actorIds}'`;
      where = where ? `${where} AND ${actorFilter}` : actorFilter;
    }
  }
  
  // Build filter for start input if needed
  const startFilter = filterStartInput ? `id NOT IN (0, 1)` : '';
  
  // Combine WHERE clause
  if (startFilter) {
    where = where ? `${where} AND ${startFilter}` : startFilter;
  }
  
  // If still no where clause, default to all (except start input if filtered)
  if (!where) {
    where = '1=1';
  }
  
  const limitClause = ` LIMIT ${limit} OFFSET ${offset}`;
  
  // Get total counts first (without limit/offset)
  const dentriesCountSQL = `SELECT COUNT(*) as count FROM dentries WHERE ${where};`;
  const dentriesCount = execRowsFirstOrDefault(dentriesCountSQL)?.count || 0;
  
  // Search dentries for flow conversations
  const dentriesSQL = `
    SELECT conversationid, id, dialoguetext, title, actor 
      FROM dentries 
      WHERE ${where} 
      ORDER BY conversationid, id 
      ${limitClause};`;
  const dentriesResults = execRows(dentriesSQL);
  
  // Also search dialogues table for orbs and tasks (they use description as dialogue text)
  let dialoguesWhere = "";
  if (raw) {
    dialoguesWhere = `(description LIKE '%${safe}%' OR title LIKE '%${safe}%') AND type IN ('orb', 'task')`;
  } else {
    dialoguesWhere = `type IN ('orb', 'task')`;
  }
  
  // Handle multiple actor IDs for dialogues
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map(id => `'${id}'`).join(',');
      // For orbs and tasks, check both actor and conversant fields
      // Always include actor/conversant = 0 (unassigned orbs/tasks)
      dialoguesWhere += ` AND (actor IN (${actorList}, '0') OR conversant IN (${actorList}, '0'))`;
    } else if (typeof actorIds === 'string' || typeof actorIds === 'number') {
      dialoguesWhere += ` AND (actor='${actorIds}' OR conversant='${actorIds}' OR actor='0' OR conversant='0')`;
    }
  }
  
  // Get count for dialogues
  const dialoguesCountSQL = `SELECT COUNT(*) as count FROM dialogues WHERE ${dialoguesWhere};`;
  const dialoguesCount = execRowsFirstOrDefault(dialoguesCountSQL)?.count || 0;
  
  const dialoguesSQL = `
    SELECT id as conversationid, id, description as dialoguetext, title, actor 
      FROM dialogues 
      WHERE ${dialoguesWhere} 
      ORDER BY id 
      ${limitClause};`;
  const dialoguesResults = execRows(dialoguesSQL);
  
  // Also search alternates table for alternate dialogue lines
  let alternatesWhere = "";
  if (raw) {
    alternatesWhere = `alternateline LIKE '%${safe}%'`;
  }
  
  // Handle multiple actor IDs for alternates (join with dentries to get actor)
  if (actorIds) {
    if (Array.isArray(actorIds) && actorIds.length > 0) {
      const actorList = actorIds.map(id => `'${id}'`).join(',');
      const actorFilter = `d.actor IN (${actorList})`;
      alternatesWhere = alternatesWhere ? `${alternatesWhere} AND ${actorFilter}` : actorFilter;
    } else if (typeof actorIds === 'string' || typeof actorIds === 'number') {
      const actorFilter = `d.actor='${actorIds}'`;
      alternatesWhere = alternatesWhere ? `${alternatesWhere} AND ${actorFilter}` : actorFilter;
    }
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
    alternatesResults = execRows(alternatesSQL).map(r => ({ ...r, isAlternate: true }));
  }
  
  // Calculate total count
  const totalCount = dentriesCount + dialoguesCount + alternatesCount;
  
  // Combine results
  return {
    results: [...dentriesResults, ...dialoguesResults, ...alternatesResults],
    total: totalCount
  };
}

/* Cache helpers */
export function cacheEntry(convoId, entryId, payload) {
  entryCache.set(`${convoId}:${entryId}`, payload);
}
export function getCachedEntry(convoId, entryId) {
  return entryCache.get(`${convoId}:${entryId}`);
}
export function clearCacheForEntry(convoId, entryId) {
  entryCache.delete(`${convoId}:${entryId}`);
}

export function clearCaches() {
  entryCache.clear();
}
