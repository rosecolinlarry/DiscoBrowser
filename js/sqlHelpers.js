let _db = null;
let SQL = null;

export async function initDatabase(sqlFactory, path = "db/discobase.sqlite3") {
  // Wraps sql.js Database and provides helper methods, search, and simple caching.
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
export function getConversationById(convoId, showHidden) {
  // Get the conversation's task related fields
  convoId = parseInt(convoId);
  if (!Number.isInteger(convoId)) {
    return;
  }
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
export function getAllConversations(showHidden) {
  let q = `SELECT id, title, type FROM conversations `;
  if (!showHidden) {
    q += `WHERE isHidden != 1 `;
  }
  q += `ORDER BY title;`;
  return execRows(q);
}
export function getEntriesForConversation(convoId, showHidden) {
  convoId = parseInt(convoId);
  if (!Number.isInteger(convoId)) {
    return;
  }
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
export function getDistinctActors() {
  return execRows(
    `SELECT DISTINCT id, name FROM actors WHERE name IS NOT NULL AND name != '' ORDER BY name;`
  );
}
export function getActorNameById(actorId) {
  actorId = parseInt(actorId);
  if (!Number.isInteger(actorId)) {
    return;
  }
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
export function getEntry(convoId, entryId) {
  entryId = parseInt(entryId);
  convoId = parseInt(convoId);
  if (!Number.isInteger(entryId) || !Number.isInteger(convoId)) {
    return;
  }
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
export function getAlternates(convoId, entryId) {
  entryId = parseInt(entryId);
  convoId = parseInt(convoId);
  if (!Number.isInteger(entryId) || !Number.isInteger(convoId)) {
    return;
  }
  return execRows(
    `SELECT conversationid, dialogueid, alternateline, condition 
      FROM alternates 
      WHERE conversationid=${convoId} 
      AND dialogueid=${entryId};`
  );
}
export function getChecks(convoId, entryId) {
  entryId = parseInt(entryId);
  convoId = parseInt(convoId);
  if (!Number.isInteger(entryId) || !Number.isInteger(convoId)) {
    return;
  }
  return execRows(
    `SELECT checktype, difficulty, flagName, forced, a.name
      FROM checks c
	    LEFT JOIN dentries d ON c.dialogueid = d.id AND c.conversationid = d.conversationid
	    LEFT JOIN actors a ON a.articyId = c.skilltype
      WHERE d.conversationid=${convoId} 
      AND dialogueid=${entryId};`
  );
}
export function getParentsChildren(convoId, entryId) {
  entryId = parseInt(entryId);
  convoId = parseInt(convoId);
  if (!Number.isInteger(entryId) || !Number.isInteger(convoId)) {
    return;
  }
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

    let query = "SELECT id, title, dialoguetext, actor, isHidden FROM dentries ";
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

function run(sql) {
  if (!_db) throw new Error("DB not initialized");
  return _db.exec(sql);
}