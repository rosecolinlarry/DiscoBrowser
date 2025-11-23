// db.js
// Wraps sql.js Database and provides helper methods, search, and simple caching.

let _db = null;
let SQL = null;

const entryCache = new Map();
const conversationCache = new Map();

export async function initDatabase(sqlFactory, path = "db/discobase.sqlite3") {
  SQL = sqlFactory;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    _db = new SQL.Database(new Uint8Array(buffer));
    console.info("Database loaded:", path);
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

/* Conversations list (no heavy processing) */
export function getAllConversations() {
  const rows = execRows(`SELECT id, title FROM dialogues ORDER BY title;`);
  return rows;
}

/* Actors */
export function getDistinctActors() {
  return execRows(
    `SELECT DISTINCT id, name FROM actors WHERE name IS NOT NULL AND name != '' ORDER BY name;`
  );
}

/* Check for dead-end conversation quickly */
export function isDeadEndConversation(convoID) {
  // Check quickly via count and checking titles
  const rows = execRows(
    `SELECT title FROM dentries WHERE conversationid='${convoID}' ORDER BY id;`
  );
  if (rows.length === 2) {
    const t0 = (rows[0].title || "").toLowerCase();
    const t1 = (rows[1].title || "").toLowerCase();
    const arr = [t0, t1].sort();
    return arr[0] === "input" && arr[1] === "start";
  }
  return false;
}

/* Load dentries for a conversation (summary listing) */
export function getEntriesForConversation(convoID) {
  return execRows(`
    SELECT dentries.id AS id,
           dentries.title AS title,
           dentries.dialoguetext AS dialoguetext,
           dentries.actor AS actor
    FROM dentries
    WHERE dentries.conversationid='${convoID}'
    ORDER BY dentries.id;
  `);
}

/* Fetch a single entry row (core fields) */
export function getEntry(convoID, entryID) {
  const rows = execRows(
    `SELECT id, title, dialoguetext, actor, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass FROM dentries WHERE conversationid='${convoID}' AND id='${entryID}' LIMIT 1;`
  );
  return rows[0] || null;
}

/* Fetch alternates for an entry */
export function getAlternates(convoID, entryID) {
  return execRows(
    `SELECT alternateline, condition FROM alternates WHERE conversationid=${convoID} AND dialogueid=${entryID};`
  );
}

/* Fetch check(s) for an entry */
export function getChecks(convoID, entryID) {
  return execRows(
    `SELECT isred, difficulty, flagname, forced, skilltype FROM checks WHERE conversationid=${convoID} AND dialogueid=${entryID};`
  );
}

/* Fetch parents and children dlinks for an entry */
export function getParentsChildren(convoID, entryID) {
  const parents = execRows(`
    SELECT originconversationid AS o_convo, origindialogueid AS o_id, priority, isConnector
    FROM dlinks
    WHERE destinationconversationid=${convoID} AND destinationdialogueid=${entryID};
  `);
  const children = execRows(`
    SELECT destinationconversationid AS d_convo, destinationdialogueid AS d_id, priority, isConnector
    FROM dlinks
    WHERE originconversationid=${convoID} AND origindialogueid=${entryID};
  `);
  return { parents, children };
}

/* Fetch destination entries batched (for link lists) */
export function getEntriesBulk(pairs = []) {
  // pairs = [{convo, id}, ...] -> batch by convo to use IN
  if (!pairs.length) return [];
  const byConvo = new Map();
  for (const p of pairs) {
    const arr = byConvo.get(p.convo) || [];
    arr.push(p.id);
    byConvo.set(p.convo, arr);
  }
  const results = [];
  for (const [convo, ids] of byConvo.entries()) {
    const inList = ids.map((i) => String(i)).join(",");
    const rows = execRows(
      `SELECT id, title, dialoguetext, actor FROM dentries WHERE conversationid='${convo}' AND id IN (${inList});`
    );
    rows.forEach((r) => {
      results.push({
        convo,
        id: r.id,
        title: r.title,
        dialoguetext: r.dialoguetext,
        actor: r.actor,
      });
    });
  }
  return results;
}

export function searchDialogues(q, actorId = null, limit = 1000) {
  const raw = (q || "").trim();
  if (!raw) {
    // No query -> return empty array (caller will handle limits)
    return [];
  }

  // Make a SQL-safe single-quoted literal (basic)
  const safe = raw.replace(/'/g, "''");

  // Fallback: LIKE-based search (slower)
  let where = `(dialoguetext LIKE '%${safe}%' OR title LIKE '%${safe}%')`;
  if (actorId) where += ` AND actor='${actorId}'`;
  const limitClause = raw.length <= 3 ? ` LIMIT ${limit}` : "";
  const sql = `SELECT conversationid, id, dialoguetext, title, actor FROM dentries WHERE ${where} ORDER BY conversationid, id ${limitClause};`;
  return execRows(sql);
}

/* Cache helpers */
export function cacheEntry(convo, id, payload) {
  entryCache.set(`${convo}:${id}`, payload);
}
export function getCachedEntry(convo, id) {
  return entryCache.get(`${convo}:${id}`);
}

export function clearCaches() {
  entryCache.clear();
  conversationCache.clear();
}