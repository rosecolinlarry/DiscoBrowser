// Ensure sql-wasm.js is available; if it's not already loaded via a <script> tag,
// dynamically load it from the CDN so this will still work on a plain GitHub Pages site.
(async () => {
  // If initSqlJs isn't present (script tag missing or blocked), try to load a
  // vendored copy first (./vendor/sql-wasm), then node_modules, and finally CDN.
  // This lets us vendor the required files for GitHub Pages while still using
  // node_modules during local development.
  let useVendor = false;
  let useLocalSqlJs = false;
  if (typeof initSqlJs === "undefined") {
    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });

    // Try vendored copy first (this is what we'll commit into the repo)
    try {
      await loadScript("./vendor/sql-wasm/sql-wasm.js");
      useVendor = true;
      console.info("Loaded vendored sql-wasm.js from ./vendor/sql-wasm/");
    } catch (_) {
      // Vendored not present; try node_modules (local dev)
      try {
        await loadScript("./node_modules/sql.js/dist/sql-wasm.js");
        useLocalSqlJs = true;
        console.info("Loaded local sql-wasm.js from node_modules");
      } catch (err) {
        // Fall back to CDN for hosted sites
        console.warn("Local sql-wasm.js not found; falling back to CDN");
        await loadScript(
          "https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js"
        );
      }
    }
  }

  // Initialize the sql.js library. locateFile points to the matching .wasm
  // next to whichever script we successfully loaded.
  const SQL = await initSqlJs({
    locateFile: (file) =>
      useVendor
        ? `./vendor/sql-wasm/${file}`
        : useLocalSqlJs
        ? `./node_modules/sql.js/dist/${file}`
        : `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`,
  });

  const outputEl = document.getElementById("output");
  const pageSizeInput = document.getElementById('pageSize');
  const searchInput = document.getElementById('search');
  const searchBtn = document.getElementById('searchBtn');
  const convoListEl = document.getElementById('convoList');
  const entryListEl = document.getElementById('entryList');
  const entryDetailsEl = document.getElementById('entryDetails');
  // Note: UI for running arbitrary SQL and downloading the DB has been removed.

  let db = null;

  async function loadDatabase(path = "db/discobase.sqlite3") {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
      const buffer = await res.arrayBuffer();
      db = new SQL.Database(new Uint8Array(buffer));
    } catch (err) {
      console.error(err);
    }
  }

  function renderResults(sql, results) {
    if (!results || results.length === 0) {
      outputEl.innerHTML = "<em>No rows returned.</em>";
      return;
    }
    // We'll render only the first result set with pagination; for multiple
    // result sets, append them sequentially without pagination.
    outputEl.innerHTML = "";

    // Helper to create a table from cols + values slice
    const createTable = (cols, valuesSlice) => {
      const table = document.createElement("table");
      table.className = "results-table";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      cols.forEach((c) => {
        const th = document.createElement("th");
        th.textContent = c;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      valuesSlice.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((cell) => {
          const td = document.createElement("td");
          td.textContent = cell === null ? "NULL" : String(cell);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      return table;
    };

    // Pagination state for the first result
    const first = results[0];
    const cols = first.columns;
    const values = first.values;
    let pageSize = 100;
    if (pageSizeInput) {
      const v = parseInt(pageSizeInput.value, 10);
      if (!Number.isNaN(v) && v > 0) pageSize = v;
    }
    let currentPage = 0;
    const totalRows = values.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

    const renderPage = (page) => {
      // Remove previous page elements if present
      const existing = outputEl.querySelector('.results-paged');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.className = 'results-paged';

      if (results.length > 1) {
        const title = document.createElement('div');
        title.className = 'results-title';
        title.textContent = `Result set 1 (showing rows ${page*pageSize + 1}-${Math.min((page+1)*pageSize, totalRows)} of ${totalRows})`;
        container.appendChild(title);
      }

      const start = page * pageSize;
      const slice = values.slice(start, start + pageSize);
      container.appendChild(createTable(cols, slice));

      if (totalPages > 1) {
        const nav = document.createElement('div');
        nav.style.marginTop = '8px';
        nav.style.display = 'flex';
        nav.style.gap = '8px';
        const prev = document.createElement('button');
        prev.textContent = 'Prev';
        prev.disabled = page === 0;
        prev.addEventListener('click', () => { currentPage = Math.max(0, currentPage - 1); renderPage(currentPage); });
        const next = document.createElement('button');
        next.textContent = 'Next';
        next.disabled = page >= totalPages - 1;
        next.addEventListener('click', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); renderPage(currentPage); });
        const info = document.createElement('div');
        info.style.alignSelf = 'center';
        info.textContent = `Page ${page+1} of ${totalPages}`;
        nav.appendChild(prev);
        nav.appendChild(next);
        nav.appendChild(info);
        container.appendChild(nav);
      }

      outputEl.appendChild(container);
    };

    // Render the first result with pagination
    renderPage(0);

    // Render any remaining result sets (2..N) without pagination
    for (let i = 1; i < results.length; i++) {
      const r = results[i];
      const title = document.createElement('div');
      title.className = 'results-title';
      title.textContent = `Result set ${i+1}`;
      outputEl.appendChild(title);
      outputEl.appendChild(createTable(r.columns, r.values));
    }
  }

  // Strip comments (/* ... */ and -- ...) and whitespace
  // NOTE: comment-stripping and read-only query enforcement have been removed.

  // Internal helper to run SQL against the in-memory DB. Not exposed to users.
  function _internalRunSQL(sql) {
    if (!db) {
      console.warn('Database not loaded yet.');
      return;
    }
    try {
      // db.exec returns an array of result objects {columns:[], values:[[]]}
      const res = db.exec(sql);
      renderResults(sql, res);
    } catch (err) {
      console.error('SQL error:', err);
    }
  }

  // The clickable UI for executing arbitrary SQL or exporting the DB has been removed
  // to prevent exposing the full in-memory DB or permitting arbitrary statements.

  // Load the database (path points to the repo's db folder so it works on GitHub Pages)
  await loadDatabase("db/discobase.sqlite3");

  // After loading, show a list of tables/views as a helpful default view.
  // This is non-destructive and should work on any SQLite file.
  if (db) {
    try {
      _internalRunSQL(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;"
      );
    } catch (e) {
      // ignore - user can run their own queries
    }
    // initialize dialogue browser lists
    try { await loadConversations(); } catch (e) { console.warn('Could not load conversations', e); }
  }

  // --- Dialogue browser features ---
  async function loadConversations() {
    if (!db) return;
    const res = db.exec("SELECT id, title FROM dialogues ORDER BY title LIMIT 500;");
    convoListEl.innerHTML = '';
    if (!res || res.length === 0) {
      convoListEl.textContent = '(no conversations found)';
      return;
    }
    const rows = res[0].values;
    rows.forEach(r => {
      const id = r[0];
      const title = r[1] || `(id ${id})`;
      const div = document.createElement('div');
      div.className = 'convo-item';
      div.textContent = title;
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => loadEntriesForConversation(id));
      convoListEl.appendChild(div);
    });
  }

  async function loadEntriesForConversation(convoID) {
    if (!db) return;
    const q = `SELECT id, title, dialoguetext, actor FROM dentries WHERE conversationid='${convoID}' ORDER BY id LIMIT 1000;`;
    const res = db.exec(q);
    entryListEl.innerHTML = '';
    if (!res || res.length === 0) { entryListEl.textContent = '(no entries)'; return; }
    const rows = res[0].values;
    rows.forEach(r => {
      const id = r[0];
      const title = r[1] || '';
      const text = r[2] || '';
      const actor = r[3];
      const el = document.createElement('div');
      el.className = 'entry-item';
      el.style.cursor = 'pointer';
      el.innerHTML = `<strong>${id}</strong> ${title} <div style="color:#666">${text.substring(0,200)}</div>`;
      el.addEventListener('click', () => showEntryDetails(convoID, id));
      entryListEl.appendChild(el);
    });
  }

  async function showEntryDetails(convoID, entryID) {
    if (!db) return;
    const q = `SELECT dentries.id, dentries.title, dentries.dialoguetext, dentries.actor, actors.name as actor_name, dentries.conversationid, dentries.hascheck, dentries.hasalts, dentries.sequence, dentries.conditionstring, dentries.userscript, dentries.difficultypass FROM dentries LEFT JOIN actors ON dentries.actor=actors.id WHERE dentries.conversationid='${convoID}' AND dentries.id='${entryID}';`;
    const res = db.exec(q);
    if (!res || res.length === 0) { entryDetailsEl.textContent = '(not found)'; return; }
    const r = res[0].values[0];
    const [id, title, dialoguetext, actorid, actor_name, conversationid, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass] = r;
    const container = document.createElement('div');
    container.innerHTML = `<h4>${title || '(no title)'} — #${id}</h4><p><strong>Actor:</strong> ${actor_name || actorid}</p><p>${dialoguetext}</p>`;

    // alternates
    if (hasalts > 0) {
      const altQ = `SELECT alternates.alternateline, alternates.replaces FROM alternates WHERE alternates.conversationid='${convoID}' AND alternates.dialogueid='${entryID}';`;
      try {
        const altRes = db.exec(altQ);
        if (altRes && altRes.length) {
          const alts = altRes[0].values;
          const altsDiv = document.createElement('div');
          altsDiv.innerHTML = '<h5>Alternates</h5>';
          alts.forEach(a => { altsDiv.innerHTML += `<div style="color:#333">${a[0]} <small style="color:#666">(replaces: ${a[1]})</small></div>`; });
          container.appendChild(altsDiv);
        }
      } catch (e) { /* ignore */ }
    }

    // checks
    if (hascheck > 0) {
      try {
        const chkRes = db.exec(`SELECT * FROM checks WHERE conversationid='${convoID}' AND lineid='${entryID}';`);
        if (chkRes && chkRes.length) {
          const chks = chkRes[0];
          const chkDiv = document.createElement('div');
          chkDiv.innerHTML = '<h5>Checks</h5>';
          chkDiv.innerHTML += `<pre style="white-space:pre-wrap;color:#333">${JSON.stringify(chks, null, 2)}</pre>`;
          container.appendChild(chkDiv);
        }
      } catch (e) { /* ignore */ }
    }

    // links (parents/children)
    try {
      const linksRes = db.exec(`SELECT sourceid,targetid,linktype FROM dlinks WHERE conversationid='${convoID}' AND (sourceid='${entryID}' OR targetid='${entryID}');`);
      if (linksRes && linksRes.length) {
        const links = linksRes[0].values;
        const linksDiv = document.createElement('div');
        linksDiv.innerHTML = '<h5>Links (parents/children)</h5>';
        links.forEach(l => {
          linksDiv.innerHTML += `<div style="color:#333">${l[0]} -> ${l[1]} (${l[2]})</div>`;
        });
        container.appendChild(linksDiv);
      }
    } catch (e) { /* ignore */ }

    // extra info
    const exDiv = document.createElement('div');
    exDiv.innerHTML = `<h5>Meta</h5><div>Sequence: ${sequence}</div><div>Condition: ${conditionstring}</div><div>Userscript: ${userscript}</div><div>Difficulty: ${difficultypass}</div>`;
    container.appendChild(exDiv);

    entryDetailsEl.innerHTML = '';
    entryDetailsEl.appendChild(container);
  }

  async function searchDialogues(q) {
    if (!db) return;
    const safe = q.replace(/'/g, "''");
    const sql = `SELECT conversationid, id, dialoguetext, title FROM dentries WHERE dialoguetext LIKE '%${safe}%' OR title LIKE '%${safe}%' LIMIT 500;`;
    try {
      const res = db.exec(sql);
      entryListEl.innerHTML = '';
      if (!res || res.length === 0) { entryListEl.textContent = '(no matches)'; return; }
      res[0].values.forEach(r => {
        const [convoid, id, text, title] = r;
        const div = document.createElement('div');
        div.style.cursor = 'pointer';
        div.innerHTML = `<strong>${convoid}:${id}</strong> ${title || ''} <div style="color:#666">${text.substring(0,200)}</div>`;
        div.addEventListener('click', () => showEntryDetails(convoid, id));
        entryListEl.appendChild(div);
      });
    } catch (e) { entryListEl.textContent = 'Search error'; console.error(e); }
  }

  if (searchBtn && searchInput) searchBtn.addEventListener('click', () => searchDialogues(searchInput.value));
  if (searchInput) searchInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') searchDialogues(searchInput.value); });
})();
