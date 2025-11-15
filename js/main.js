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
  const chatLogEl = document.getElementById('chatLog');
  const backBtn = document.getElementById('backBtn');
  const backStatus = document.getElementById('backStatus');
  // Note: UI for running arbitrary SQL and downloading the DB has been removed.

  let db = null;
  let currentConversationId = null;
  let selectedConversationNode = null;
  let navigationHistory = []; // Track navigation path for back button

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
    if (!outputEl) return; // Skip if output element doesn't exist
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

    // Build a hierarchical tree from titles split by '/'
    const root = { children: Object.create(null) };
    const convoTitleById = Object.create(null);
    rows.forEach(r => {
      const id = r[0];
      const raw = (r[1] || `(id ${id})`).trim();
      convoTitleById[id] = raw;
      const parts = raw.split('/').map(p => p.trim()).filter(p => p.length>0);
      if (parts.length === 0) parts.push(raw);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!node.children[part]) node.children[part] = { children: Object.create(null), convoIds: [] };
        node = node.children[part];
        if (i === parts.length - 1) node.convoIds.push(id);
      }
    });

    // Render the tree into DOM
    // Helper to count total convo ids in a subtree
    const subtreeCount = (nodeObj) => {
      let c = (nodeObj.convoIds && nodeObj.convoIds.length) || 0;
      Object.keys(nodeObj.children).forEach(k => { c += subtreeCount(nodeObj.children[k]); });
      return c;
    };

    // Helper to find the single convo id in a subtree when count==1
    const findSingleConvoId = (nodeObj) => {
      if (nodeObj.convoIds && nodeObj.convoIds.length === 1) return nodeObj.convoIds[0];
      for (const k of Object.keys(nodeObj.children)) {
        const child = nodeObj.children[k];
        const c = subtreeCount(child);
        if (c > 0) {
          const found = findSingleConvoId(child);
          if (found) return found;
        }
      }
      return null;
    };

    const makeNode = (name, nodeObj) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'node';

      const label = document.createElement('div');
      label.className = 'label';

      const toggle = document.createElement('span');
      toggle.className = 'toggle';
      // determine if expandable
      const total = subtreeCount(nodeObj);
      const hasChildren = Object.keys(nodeObj.children).length > 0;
      const hasConvos = nodeObj.convoIds && nodeObj.convoIds.length > 0;
      // Only show a toggle if this node's subtree contains more than one conversation
      if (total > 1) toggle.textContent = '▸'; else toggle.textContent = '';
      label.appendChild(toggle);

      const titleSpan = document.createElement('span');
      titleSpan.textContent = name;
      label.appendChild(titleSpan);
      wrapper.appendChild(label);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'children';

      // If this subtree contains exactly one conversation, render that convo as a single leaf
      if (total === 1) {
        const singleId = findSingleConvoId(nodeObj);
        if (singleId) {
          const leaf = document.createElement('div');
          leaf.className = 'leaf';
          const leafLabel = document.createElement('div');
          leafLabel.className = 'label';
          leafLabel.textContent = `${convoTitleById[singleId]} — #${singleId}`;
          leafLabel.title = convoTitleById[singleId];
          leafLabel.style.cursor = 'pointer';
          leafLabel.setAttribute('data-convo-id', String(singleId));
          leafLabel.dataset.convoId = singleId;
          leafLabel.addEventListener('click', () => {
            loadEntriesForConversation(singleId);
            highlightConversationInTree(singleId);
          });
          leaf.appendChild(leafLabel);
          childrenContainer.appendChild(leaf);
          // Make the top-level label also act as a shortcut to open this single conversation
          // (clicking the visible conversation title should load entries).
          label.style.cursor = 'pointer';
          label.addEventListener('click', (ev) => { 
            ev.stopPropagation(); 
            loadEntriesForConversation(singleId);
            highlightConversationInTree(singleId);
          });
          wrapper.appendChild(childrenContainer);
          return wrapper;
        }
      }

      // add convo leaves (when multiple or standalone at this node)
      if (hasConvos) {
        nodeObj.convoIds.forEach(cid => {
          const leaf = document.createElement('div');
          leaf.className = 'leaf';
          const leafLabel = document.createElement('div');
          leafLabel.className = 'label';
          // Show the last segment text alongside the conversation id
          leafLabel.textContent = `${name} — #${cid}`;
          leafLabel.style.cursor = 'pointer';
          leafLabel.setAttribute('data-convo-id', String(cid));
          leafLabel.dataset.convoId = cid;
          leafLabel.addEventListener('click', () => {
            loadEntriesForConversation(cid);
            highlightConversationInTree(cid);
          });
          leaf.appendChild(leafLabel);
          childrenContainer.appendChild(leaf);
        });
      }

      // add child nodes
      const childKeys = Object.keys(nodeObj.children).sort((a,b)=>a.localeCompare(b));
      childKeys.forEach(k => {
        const childNode = makeNode(k, nodeObj.children[k]);
        childrenContainer.appendChild(childNode);
      });

      wrapper.appendChild(childrenContainer);

      // toggle behavior
      if (hasChildren || hasConvos) {
        label.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const expanded = wrapper.classList.toggle('expanded');
          toggle.textContent = expanded ? '▾' : '▸';
        });
      }
      return wrapper;
    };

    // create top-level list
    const treeRoot = document.createElement('div');
    treeRoot.className = 'tree';
    const topKeys = Object.keys(root.children).sort((a,b)=>a.localeCompare(b));
    topKeys.forEach(k => {
      treeRoot.appendChild(makeNode(k, root.children[k]));
    });
    convoListEl.appendChild(treeRoot);
  }

  async function loadEntriesForConversation(convoID) {
    if (!db) return;
    // Reset navigation for this conversation (clear chat log)
    resetNavigation(convoID);

    // Load all entries for listing (user may pick a starting line)
    const q = `SELECT id, title, dialoguetext, actor FROM dentries WHERE conversationid='${convoID}' ORDER BY id LIMIT 1000;`;
    const res = db.exec(q);
    entryListEl.innerHTML = '';
    if (!res || res.length === 0) {
      entryListEl.textContent = '(no entries)';
      return;
    }
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
      // Navigation click: navigate into this entry (append to chat, show details, load next options)
      el.addEventListener('click', () => navigateToEntry(convoID, id));
      entryListEl.appendChild(el);
    });
  }

  function resetNavigation(convoID) {
    currentConversationId = convoID;
    navigationHistory = [{ convoID, entryID: null }]; // Start fresh for this conversation
    if (chatLogEl) {
      chatLogEl.innerHTML = ''; // clear log
      const hint = document.createElement('div');
      hint.style.color = '#666';
      hint.style.fontSize = '13px';
      hint.textContent = '(navigation log - click a line to begin)';
      chatLogEl.appendChild(hint);
    }
    updateBackButtonState();
  }

  function highlightConversationInTree(convoID) {
    // Remove highlight from all parent labels first
    const allLabels = convoListEl.querySelectorAll('.node > .label.selected');
    allLabels.forEach(label => {
      label.classList.remove('selected');
    });

    // Find the leaf with data-convo-id, then highlight its parent node's label
    let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoID}"]`);
    if (!leafLabel) {
      leafLabel = convoListEl.querySelector(`[data-convo-id="${String(convoID)}"]`);
    }
    
    if (leafLabel) {
      // Walk up the tree to find the parent .node, then highlight its .label
      let node = leafLabel.closest('.node');
      if (node) {
        const parentLabel = node.querySelector(':scope > .label');
        if (parentLabel) {
          parentLabel.classList.add('selected');
          console.log('Highlighted conversation', convoID, parentLabel);
        }
      }
    } else {
      console.warn('Could not find conversation node with data-convo-id=' + convoID);
    }
  }

  function goBack() {
    if (navigationHistory.length <= 1) return; // Can't go back if at start
    navigationHistory.pop(); // Remove current entry
    const previous = navigationHistory[navigationHistory.length - 1];
    if (previous) {
      navigateToEntry(previous.convoID, previous.entryID, false);
    }
  }

  async function navigateToEntry(convoID, entryID, addToHistory = true) {
    if (!db) return;
    // Fetch the entry details
    const q = `SELECT id, title, dialoguetext, actor, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass FROM dentries WHERE conversationid='${convoID}' AND id='${entryID}';`;
    const res = db.exec(q);
    if (!res || res.length === 0) {
      console.warn('Entry not found', convoID, entryID);
      return;
    }
    const r = res[0].values[0];
    const [id, title, dialoguetext] = [r[0], r[1], r[2]]; // rest used by showEntryDetails which we call below

    // Track in navigation history
    if (addToHistory) {
      navigationHistory.push({ convoID, entryID: id });
    }

    // Append to chat log
    if (chatLogEl) {
      // Remove hint if present
      if (chatLogEl.children.length === 1 && chatLogEl.children[0].textContent && chatLogEl.children[0].textContent.includes('(navigation log')) {
        chatLogEl.innerHTML = '';
      }
      const item = document.createElement('div');
      item.className = 'chat-item';
      const titleDiv = document.createElement('div');
      titleDiv.className = 'chat-title';
      titleDiv.textContent = `${title || '(no title)'} — #${id}`;
      const textDiv = document.createElement('div');
      textDiv.className = 'chat-text';
      textDiv.textContent = dialoguetext || '';
      item.appendChild(titleDiv);
      item.appendChild(textDiv);
      chatLogEl.appendChild(item);
      // Scroll to bottom
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
    }

    // Show details in details pane (reuse existing function if present)
    try {
      await showEntryDetails(convoID, entryID);
    } catch (e) {
      console.warn('Could not show details', e);
    }

    // Load children (outgoing links) — using schema columns origin/destination
    // Find rows in dlinks where originconversationid/conversationid and origindialogueid == entryID
    try {
      const linkQ = `SELECT destinationconversationid as destConvo, destinationdialogueid as destId FROM dlinks WHERE originconversationid='${convoID}' AND origindialogueid='${entryID}';`;
      const linkRes = db.exec(linkQ);
      entryListEl.innerHTML = '';
      if (!linkRes || linkRes.length === 0 || linkRes[0].values.length === 0) {
        entryListEl.textContent = '(no further options)';
        return;
      }
      const linkRows = linkRes[0].values;
      // Fetch the destination entries to show as selectable options
      for (const lr of linkRows) {
        const destConvo = lr[0];
        const destId = lr[1];
        // Query the dentries for the destination line (fetch text/title)
        const destQ = `SELECT id, title, dialoguetext FROM dentries WHERE conversationid='${destConvo}' AND id='${destId}' LIMIT 1;`;
        const destRes = db.exec(destQ);
        let title = `(line ${destConvo}:${destId})`;
        let snippet = '';
        if (destRes && destRes.length && destRes[0].values.length) {
          const d = destRes[0].values[0];
          title = d[1] || title;
          snippet = d[2] || '';
        }
        const opt = document.createElement('div');
        opt.className = 'entry-item';
        opt.style.cursor = 'pointer';
        opt.innerHTML = `<strong>${destConvo}:${destId}</strong> ${title} <div style="color:#666">${snippet.substring(0,200)}</div>`;
        // Clicking navigates to that entry (appends to chat and loads its children)
        opt.addEventListener('click', () => navigateToEntry(destConvo, destId));
        entryListEl.appendChild(opt);
      }
    } catch (e) {
      console.error('Error loading child links', e);
      entryListEl.textContent = '(error loading next options)';
    }
    
    updateBackButtonState();
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
        const chkRes = db.exec(`SELECT * FROM checks WHERE conversationid='${convoID}' AND dialogueid='${entryID}';`);
        if (chkRes && chkRes.length) {
          const chks = chkRes[0];
          const chkDiv = document.createElement('div');
          chkDiv.innerHTML = '<h5>Checks</h5>';
          chkDiv.innerHTML += `<pre style="white-space:pre-wrap;color:#333">${JSON.stringify(chks, null, 2)}</pre>`;
          container.appendChild(chkDiv);
        }
      } catch (e) { /* ignore */ }
    }

    // links (parents/children) — use schema columns
    try {
      // parents: dlinks where destination == this entry
      const parentsQ = `SELECT originconversationid as oc, origindialogueid as oi, priority, isConnector FROM dlinks WHERE destinationconversationid='${convoID}' AND destinationdialogueid='${entryID}';`;
      const parentsRes = db.exec(parentsQ);
      if (parentsRes && parentsRes.length && parentsRes[0].values.length) {
        const parents = parentsRes[0].values;
        const parentsDiv = document.createElement('div');
        parentsDiv.innerHTML = '<h5>Parents</h5>';
        parents.forEach(p => {
          parentsDiv.innerHTML += `<div style="color:#333">${p[0]}:${p[1]} (priority:${p[2]} connector:${p[3]})</div>`;
        });
        container.appendChild(parentsDiv);
      }

      // children: dlinks where origin == this entry
      const childrenQ = `SELECT destinationconversationid as dc, destinationdialogueid as di, priority, isConnector FROM dlinks WHERE originconversationid='${convoID}' AND origindialogueid='${entryID}';`;
      const childrenRes = db.exec(childrenQ);
      if (childrenRes && childrenRes.length && childrenRes[0].values.length) {
        const children = childrenRes[0].values;
        const childrenDiv = document.createElement('div');
        childrenDiv.innerHTML = '<h5>Children</h5>';
        children.forEach(c => {
          childrenDiv.innerHTML += `<div style="color:#333">${c[0]}:${c[1]} (priority:${c[2]} connector:${c[3]})</div>`;
        });
        container.appendChild(childrenDiv);
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
        div.addEventListener('click', () => {
          // When a search result is clicked, treat it like navigating to that entry
          resetNavigation(convoid);
          navigateToEntry(convoid, id);
          highlightConversationInTree(convoid);
        });
        entryListEl.appendChild(div);
      });
    } catch (e) { entryListEl.textContent = 'Search error'; console.error(e); }
  }

  if (searchBtn && searchInput) searchBtn.addEventListener('click', () => searchDialogues(searchInput.value));
  if (searchInput) searchInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') searchDialogues(searchInput.value); });
  
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goBack();
      updateBackButtonState();
    });
    updateBackButtonState(); // Initialize state
  }

  function updateBackButtonState() {
    if (backBtn) {
      backBtn.disabled = navigationHistory.length <= 1;
      if (backStatus) {
        backStatus.textContent = navigationHistory.length > 1 ? `(${navigationHistory.length} steps)` : '';
      }
    }
  }
})();
