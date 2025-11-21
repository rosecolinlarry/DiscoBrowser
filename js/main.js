(async () => {
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

    try {
      await loadScript("./vendor/sql-wasm/sql-wasm.js");
      useVendor = true;
      console.info("Loaded vendored sql-wasm.js from ./vendor/sql-wasm/");
    } catch (_) {
      try {
        await loadScript("./node_modules/sql.js/dist/sql-wasm.js");
        useLocalSqlJs = true;
        console.info("Loaded local sql-wasm.js from node_modules");
      } catch (err) {
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

  const searchInput = document.getElementById("search");
  const searchBtn = document.getElementById("searchBtn");
  const actorFilter = document.getElementById("actorFilter");
  const searchLoader = document.getElementById("searchLoader");
  const convoListEl = document.getElementById("convoList");
  const entryListEl = document.getElementById("entryList");
  const entryListHeaderEl = document.getElementById("entryListHeader");
  const entryDetailsEl = document.getElementById("entryDetails");
  const entryOverviewEl = document.getElementById("entryOverview");
  const currentEntryContainerEl = document.getElementById(
    "currentEntryContainer"
  );
  const chatLogEl = document.getElementById("chatLog");
  const backBtn = document.getElementById("backBtn");
  const backStatus = document.getElementById("backStatus");
  const moreDetailsEl = document.getElementById("moreDetails");

  const minSearchLength = 3;
  const searchResultLimit = 1000;

  let db = null;
  let navigationHistory = [];
  let currentConvoId = null;
  let currentEntryId = null;

  await loadDatabase("db/discobase.sqlite3");

  if (db) {
    try {
      await loadConversations();
      await populateActorDropdown();
    } catch (e) {
      console.warn("Could not load conversations", e);
    }
  }

  // Load all actors and populate the dropdown
  async function populateActorDropdown() {
    if (!db) return;
    try {
      const q = `SELECT DISTINCT id, name FROM actors WHERE name IS NOT NULL AND name != '' ORDER BY name;`;
      const res = db.exec(q);
      if (res && res.length && res[0].values.length) {
        const actors = res[0].values;
        actors.forEach((actor) => {
          const [id, name] = actor;
          const option = document.createElement("option");
          option.value = id;
          option.textContent = name;
          actorFilter.appendChild(option);
        });
      }
    } catch (e) {
      console.warn("Could not load actors", e);
    }
  }

  // --- Dialogue browser features ---
  async function isDeadEndConversation(convoID) {
    if (!db) return false;
    // Check if conversation only contains START and input entries
    const q = `SELECT id, title 
                FROM dentries 
                WHERE conversationid='${convoID}' 
                ORDER BY id;`;
    try {
      const res = db.exec(q);
      if (!res || res.length === 0) return false;
      const rows = res[0].values;

      // If only 2 entries, check if they are START and input
      if (rows.length === 2) {
        const titles = rows.map((r) => (r[1] || "").toLowerCase()).sort();
        if (titles[0] === "input" && titles[1] === "start") {
          return true; // It's a dead end
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async function loadConversations() {
    if (!db) return;
    const q = `SELECT id, title 
                FROM dialogues 
                ORDER BY title;`;
    const res = db.exec(q);
    convoListEl.innerHTML = "";
    if (!res || res.length === 0) {
      convoListEl.textContent = "(no conversations found)";
      return;
    }
    let rows = res[0].values;

    // Filter out dead-end conversations (only START and input)
    const filtered = [];
    for (const r of rows) {
      const convoID = r[0];
      const isDeadEnd = await isDeadEndConversation(convoID);
      if (!isDeadEnd) {
        filtered.push(r);
      }
    }
    rows = filtered;

    if (rows.length === 0) {
      convoListEl.textContent = "(all conversations are dead-ends or empty)";
      return;
    }

    // Build a hierarchical tree from titles split by '/'
    const root = { children: Object.create(null) };
    const convoTitleById = Object.create(null);
    rows.forEach((r) => {
      const id = r[0];
      const raw = (r[1] || `(id ${id})`).trim();
      convoTitleById[id] = raw;
      const parts = raw
        .split("/")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (parts.length === 0) parts.push(raw);
      let node = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!node.children[part])
          node.children[part] = { children: Object.create(null), convoIds: [] };
        node = node.children[part];
        if (i === parts.length - 1) node.convoIds.push(id);
      }
    });

    // Render the tree into DOM
    // Helper to count total convo ids in a subtree
    const subtreeCount = (nodeObj) => {
      let c = (nodeObj.convoIds && nodeObj.convoIds.length) || 0;
      Object.keys(nodeObj.children).forEach((k) => {
        c += subtreeCount(nodeObj.children[k]);
      });
      return c;
    };

    // Helper to find the single convo id in a subtree when count==1
    const findSingleConvoId = (nodeObj) => {
      if (nodeObj.convoIds && nodeObj.convoIds.length === 1)
        return nodeObj.convoIds[0];
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
      const wrapper = document.createElement("div");
      wrapper.className = "node";

      const label = document.createElement("div");
      label.className = "label";

      const toggle = document.createElement("span");
      toggle.className = "toggle";
      // determine if expandable
      const total = subtreeCount(nodeObj);
      const hasChildren = Object.keys(nodeObj.children).length > 0;
      const hasConvos = nodeObj.convoIds && nodeObj.convoIds.length > 0;
      // Only show a toggle if this node's subtree contains more than one conversation
      if (total > 1) toggle.textContent = "▸";
      else toggle.textContent = "";
      label.appendChild(toggle);

      const titleSpan = document.createElement("span");
      titleSpan.textContent = name;
      label.appendChild(titleSpan);
      wrapper.appendChild(label);

      const childrenContainer = document.createElement("div");
      childrenContainer.className = "children";

      // If this subtree contains exactly one conversation, render that convo as a single leaf
      if (total === 1) {
        const singleId = findSingleConvoId(nodeObj);
        if (singleId) {
          const leaf = document.createElement("div");
          leaf.className = "leaf";
          const leafLabel = document.createElement("div");
          leafLabel.className = "label";
          leafLabel.textContent = `${convoTitleById[singleId]} — #${singleId}`;
          leafLabel.title = convoTitleById[singleId];
          leafLabel.style.cursor = "pointer";
          leafLabel.setAttribute("data-convo-id", String(singleId));
          leafLabel.dataset.convoId = singleId;
          leafLabel.addEventListener("click", () => {
            loadEntriesForConversation(singleId);
            highlightConversationInTree(singleId);
          });
          leaf.appendChild(leafLabel);
          childrenContainer.appendChild(leaf);
          // Make the top-level label also act as a shortcut to open this single conversation
          // (clicking the visible conversation title should load entries).
          label.style.cursor = "pointer";
          label.addEventListener("click", (ev) => {
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
        nodeObj.convoIds.forEach((cid) => {
          const leaf = document.createElement("div");
          leaf.className = "leaf";
          const leafLabel = document.createElement("div");
          leafLabel.className = "label";
          // Show the last segment text alongside the conversation id
          leafLabel.textContent = `${name} — #${cid}`;
          leafLabel.style.cursor = "pointer";
          leafLabel.setAttribute("data-convo-id", String(cid));
          leafLabel.dataset.convoId = cid;
          leafLabel.addEventListener("click", () => {
            loadEntriesForConversation(cid);
            highlightConversationInTree(cid);
          });
          leaf.appendChild(leafLabel);
          childrenContainer.appendChild(leaf);
        });
      }

      // add child nodes
      const childKeys = Object.keys(nodeObj.children).sort((a, b) =>
        a.localeCompare(b)
      );
      childKeys.forEach((k) => {
        const childNode = makeNode(k, nodeObj.children[k]);
        childrenContainer.appendChild(childNode);
      });

      wrapper.appendChild(childrenContainer);

      // toggle behavior
      if (hasChildren || hasConvos) {
        label.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const expanded = wrapper.classList.toggle("expanded");
          toggle.textContent = expanded ? "▾" : "▸";
        });
      }
      return wrapper;
    };

    // create top-level list
    const treeRoot = document.createElement("div");
    treeRoot.className = "tree scrolling-card";
    const topKeys = Object.keys(root.children).sort((a, b) =>
      a.localeCompare(b)
    );
    topKeys.forEach((k) => {
      treeRoot.appendChild(makeNode(k, root.children[k]));
    });
    convoListEl.appendChild(treeRoot);
  }

  async function loadEntriesForConversation(convoID) {
    if (!db) return;
    // Reset navigation for this conversation (clear chat log)
    resetNavigation(convoID);

    // Show the current entry container when loading dialogue options
    if (currentEntryContainerEl) {
      currentEntryContainerEl.style.display = "flex";
    }

    // Load all entries for listing (user may pick a starting line)
    const q = `SELECT id, title, dialoguetext, actor 
                  FROM dentries 
                  WHERE conversationid='${convoID}' 
                  ORDER BY id;`;
    const res = db.exec(q);
    entryListHeaderEl.textContent = "Next Dialogue Options";
    entryListEl.innerHTML = "";
    if (!res || res.length === 0) {
      entryListEl.textContent = "(no entries)";
      return;
    }
    const rows = res[0].values;

    // Filter out START entries (they just lead to input anyway)
    const filteredRows = rows.filter((r) => {
      const title = (r[1] || "").toLowerCase();
      return title !== "start";
    });

    if (filteredRows.length === 0) {
      entryListEl.textContent = "(no meaningful entries - only START)";
      return;
    }

    filteredRows.forEach((r) => {
      const id = r[0];
      const title = r[1] || "";
      const text = r[2] || "";
      const actor = r[3]; // Actor Id
      const el = document.createElement("div");
      el.className = "card-item";
      el.style.cursor = "pointer";
      el.innerHTML = getEntriesHtml(id, title, text);
      // Navigation click: navigate into this entry (append to chat, show details, load next options)
      el.addEventListener("click", () => navigateToEntry(convoID, id));
      entryListEl.appendChild(el);
    });
  }

  function resetNavigation(convoID) {
    navigationHistory = [{ convoID, entryID: null }]; // Start fresh for this conversation
    if (chatLogEl) {
      chatLogEl.innerHTML = ""; // clear log
      const hint = document.createElement("div");
      hint.className = "hint-text";
      hint.textContent = "(navigation log - click a line to begin)";
      chatLogEl.appendChild(hint);
    }
    updateBackButtonState();
  }

  function highlightConversationInTree(convoID) {
    // Remove highlight from all parent labels first
    const allLabels = convoListEl.querySelectorAll(".node > .label.selected");
    allLabels.forEach((label) => {
      label.classList.remove("selected");
    });

    // Find the leaf with data-convo-id, then highlight its parent node's label
    let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoID}"]`);
    if (!leafLabel) {
      leafLabel = convoListEl.querySelector(
        `[data-convo-id="${String(convoID)}"]`
      );
    }

    if (leafLabel) {
      // Walk up the tree to find the parent .node, then highlight its .label
      let node = leafLabel.closest(".node");
      if (node) {
        // Add "expanded" class to the parent node directly under .tree.scrolling-card
        let currentNode = node;
        let treeContainer = convoListEl.querySelector(".tree.scrolling-card");

        // Walk up to find the direct child of tree.scrolling-card
        while (currentNode && currentNode.parentElement !== treeContainer) {
          currentNode = currentNode.parentElement?.closest(".node");
          if (!currentNode) break;
        }

        // If we found the top-level node, expand it
        if (currentNode && currentNode.parentElement === treeContainer) {
          currentNode.classList.add("expanded");
          const toggle = currentNode.querySelector(":scope > .label > .toggle");
          if (toggle) {
            toggle.textContent = "▾";
          }
        }

        const parentLabel = node.querySelector(":scope > .label");
        if (parentLabel) {
          parentLabel.classList.add("selected");
          parentLabel.scrollIntoView();
        }
      }
    } else {
      console.warn(
        "Could not find conversation node with data-convo-id=" + convoID
      );
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

  function jumpToHistoryPoint(historyIndex) {
    if (historyIndex < 0 || historyIndex >= navigationHistory.length) return;

    // Truncate history to this point (remove everything after)
    navigationHistory = navigationHistory.slice(0, historyIndex + 1);

    // Navigate to this point
    const target = navigationHistory[historyIndex];
    if (target && target.entryID) {
      navigateToEntry(target.convoID, target.entryID, false);
    }
  }

  async function navigateToEntry(convoID, entryID, addToHistory = true) {
    if (!db) return;
    // Fetch the entry details

    // Open the current entry container
    if (currentEntryContainerEl) {
      currentEntryContainerEl.style.visibility = "visible";
    }

    const q = `
      SELECT id, title, dialoguetext, actor, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass 
        FROM dentries 
        WHERE conversationid='${convoID}' 
        AND id='${entryID}';`;
    const res = db.exec(q);
    if (!res || res.length === 0) {
      console.warn("Entry not found", convoID, entryID);
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
      if (
        chatLogEl.children.length === 1 &&
        chatLogEl.children[0].textContent &&
        chatLogEl.children[0].textContent.includes("(navigation log")
      ) {
        chatLogEl.innerHTML = "";
      }
      const item = document.createElement("div");
      item.className = "card-item";
      item.style.cursor = "pointer";

      // Store the history index so we can jump back to this point
      const historyIndex = navigationHistory.length - 1;

      const titleDiv = document.createElement("div");
      titleDiv.className = "card-title";
      titleDiv.textContent = `${title || "(no title)"} — #${id}`;
      const textDiv = document.createElement("div");
      textDiv.className = "card-text";
      textDiv.textContent = dialoguetext || "";
      item.appendChild(titleDiv);
      item.appendChild(textDiv);

      // Add click handler to jump back to this point in history
      // But mark this as the current item (will be updated as we navigate)
      item.dataset.historyIndex = historyIndex;
      item.addEventListener("click", function () {
        // Don't allow clicking the current (last) item
        if (this.dataset.isCurrent === "true") {
          return;
        }
        jumpToHistoryPoint(historyIndex);
      });

      chatLogEl.appendChild(item);
      // Scroll to bottom
      chatLogEl.scrollTop = chatLogEl.scrollHeight;
      // Mark all previous items as not current, mark this as current
      const allItems = chatLogEl.querySelectorAll(".card-item");
      allItems.forEach((el) => {
        el.dataset.isCurrent = "false";
        el.style.opacity = "1";
        el.style.cursor = "pointer";
      });
      item.dataset.isCurrent = "true";
      item.style.opacity = "0.7";
      item.style.cursor = "default";

      // Create the text showing the current dialogue
      entryOverviewEl.innerHTML = "";
      entryOverviewEl.className = "entry-item current-item";
      entryOverviewEl.style.cursor = "pointer";
      entryOverviewEl.innerHTML = `<div class="current-item"><strong class="speaker">${parseSpeakerFromTitle(
        title
      )}</strong></div><div class="dialogue-text">${
        dialoguetext || "<i>No dialogue.</i>"
      }</div>`;
    }
    currentConvoId = convoID;
    currentEntryId = entryID;

    // // Open the more details section so showEntryDetails can populate it
    // if (moreDetailsEl) {
    //   moreDetailsEl.open = true;
    // }

    try {
      await showEntryDetails(convoID, entryID);
    } catch (e) {
      console.warn("Could not show details", e);
    }

    function parseSpeakerFromTitle(title) {
      if (!title) return;
      let splitTitle = title.split(":");
      if (splitTitle.length > 1) {
        return splitTitle[0].trim();
      }
      return title;
    }

    // Load children (outgoing links) — using schema columns origin/destination
    // Find rows in dlinks where originconversationid/conversationid and origindialogueid == entryID
    try {
      const linkQ = `
        SELECT destinationconversationid as destConvo, destinationdialogueid as destId 
          FROM dlinks 
          WHERE originconversationid='${convoID}' 
          AND origindialogueid='${entryID}';`;
      const linkRes = db.exec(linkQ);
      entryListHeaderEl.textContent = "Next Dialogue Options";
      entryListEl.innerHTML = "";
      if (!linkRes || linkRes.length === 0 || linkRes[0].values.length === 0) {
        entryListEl.textContent = "(no further options)";
        return;
      }
      const linkRows = linkRes[0].values;
      // Fetch the destination entries to show as selectable options
      for (const lr of linkRows) {
        const destConvo = lr[0];
        const destId = lr[1];
        // Query the dentries for the destination line (fetch text/title)
        const destQ = `SELECT id, title, dialoguetext 
                          FROM dentries 
                          WHERE conversationid='${destConvo}' 
                          AND id='${destId}' 
                          LIMIT 1;`;
        const destRes = db.exec(destQ);
        let title = `(line ${destConvo}:${destId})`;
        let snippet = "";
        if (destRes && destRes.length && destRes[0].values.length) {
          const d = destRes[0].values[0];
          title = d[1] || title;
          snippet = d[2] || "";
        }

        // Skip START entries - they just lead to the next thing anyway
        if (title.toLowerCase() === "start") {
          continue;
        }

        const opt = document.createElement("div");
        opt.className = "card-item";
        opt.style.cursor = "pointer";
        const id = `${destConvo}:${destId}`;
        opt.innerHTML = getEntriesHtml(id, title, snippet.substring(0, 200));
        // Clicking navigates to that entry (appends to chat and loads its children)
        opt.addEventListener("click", () => navigateToEntry(destConvo, destId));
        entryListEl.appendChild(opt);
      }

      // If all options were filtered out, show no options
      if (entryListEl.children.length === 0) {
        entryListEl.textContent = "(no further options)";
      }
    } catch (e) {
      console.error("Error loading child links", e);
      entryListEl.textContent = "(error loading next options)";
    }

    updateBackButtonState();
  }

  function getDetailHtml(label, text, alternateText = null, id = null) {
    let content = text || "";
    if (id) {
      content += ` -- #${id}`;
    }
    return `<strong class="details-section-header">${
      label || alternateText || ""
    }</strong> <span class="details-item">${content}</span>`;
  }

  function getEntriesHtml(id, label, text) {
    let content = text || "";
    return `<strong class="card-title">${id}. ${
      label || ""
    }</strong> <span>${content}</span>`;
  }

  async function showEntryDetails(convoID, entryID) {
    if (!db || !moreDetailsEl.open) return;
    const q = `SELECT title, actor, hascheck, hasalts, sequence, conditionstring, userscript, difficultypass
                  FROM dentries 
                  WHERE conversationid='${convoID}' 
                  AND id='${entryID}';`;
    const res = db.exec(q);
    if (!res || res.length === 0) {
      entryOverviewEl.textContent = "(not found)";
      entryDetailsEl.textContent = "(not found)";
      return;
    }
    const r = res[0].values[0];
    const [
      title,
      actorid,
      hascheck,
      hasalts,
      sequence,
      conditionstring,
      userscript,
      difficultypass,
    ] = r;

    let selects = `
      SELECT
        d.title as c_title, d.description as c_desc
        , d.actor as c_actorid, a2.name as c_actorname, d.conversant as c_conversant_actorid , a3.name as conversant_actorname, a1.name as entry_actor_name
        , p.originconversationid as p_oc, p.origindialogueid as p_oi, p.priority as p_priority, p.isConnector as p_isConnector
        , c.destinationconversationid as c_dc, c.destinationdialogueid as c_di, c.priority as c_priority, c.isConnector as c_isConnector`;
    let joins = `
      		  FROM dentries de
              LEFT JOIN actors a1 ON de.actor=a1.id  AND de.actor <> 0
              LEFT JOIN dialogues d ON d.id = de.conversationid
              LEFT JOIN actors a2 ON d.actor = a2.id AND d.actor <> 0
              LEFT JOIN actors a3 ON d.conversant = a3.id AND d.conversant <> 0
              LEFT JOIN dlinks p ON p.destinationconversationid = d.id AND p.destinationdialogueid = de.id
              LEFT JOIN dlinks c ON c.originconversationid = d.id AND c.origindialogueid = de.id`;

    if (hascheck > 0) {
      selects += `, chk.isred, chk.difficulty, chk.flagname, chk.forced, chk.skilltype`;
      joins += `  LEFT JOIN checks chk ON chk.conversationid = d.id AND chk.dialogueid = de.id`;
    }

    if (hasalts > 0) {
      selects += `, alt.alternateline, alt.condition`;
      joins += ` LEFT JOIN alternates alt ON alt.conversationid = d.id AND alt.dialogueid = de.id`;
    }

    let wheres = ` WHERE de.id = ${entryID} AND d.id = ${convoID} `;

    let orderbys = ` ORDER BY p.priority DESC, c.priority DESC;`;

    let giantSqlQuery = selects + joins + wheres + orderbys;
    let d_titlec_title;
    let d_descriptionc_desc;
    let d_actorc_actorid;
    let a2_namec_actorname;
    let d_conversantc_conversant_actorid;
    let a3_nameconversant_actorname;
    let a1_nameentry_actor_name;
    let isred;
    let difficulty;
    let flagname;
    let forced;
    let skilltype;
    let hasaltsstartindex = 15;
    let resultCount = 0;
    let details;
    try {
      const giantRes = db.exec(giantSqlQuery);
      if (giantRes && giantRes.length) {
        details = giantRes[0].values;

        resultCount = giantRes[0].values.length;

        d_titlec_title = details[0][0];
        d_descriptionc_desc = details[0][1];
        d_actorc_actorid = details[0][2];
        a2_namec_actorname = details[0][3];
        d_conversantc_conversant_actorid = details[0][4];
        a3_nameconversant_actorname = details[0][5];
        a1_nameentry_actor_name = details[0][6];

        if (hascheck) {
          hasaltsstartindex += 5;
          isred = details[0][15];
          difficulty = details[0][16];
          flagname = details[0][17];
          forced = details[0][18];
          skilltype = details[0][19];
        }
      }
    } catch (e) {
      console.error(e);
    }
    const container = document.createElement("div");

    const convoTitleDiv = document.createElement("div");
    convoTitleDiv.innerHTML = getDetailHtml(
      "Title",
      title,
      "(no title)",
      entryID
    );
    container.appendChild(convoTitleDiv);
    if (a1_nameentry_actor_name) {
      const actorDiv = document.createElement("div");
      actorDiv.innerHTML = getDetailHtml(
        "Actor",
        a1_nameentry_actor_name,
        "(no actor)",
        actorid
      );
      container.appendChild(actorDiv);
    }
    // alternates
    if (hasalts > 0) {
      const altsDiv = document.createElement("div");
      const altsHeader = document.createElement("div");
      altsHeader.className = "details-section-header";
      altsHeader.textContent = "Alternates";
      altsDiv.appendChild(altsHeader);

      const altsList = document.createElement("div");
      altsList.className = "details-list";

      for (let i = 0; i < resultCount; i++) {
        const alternateline = details[i][hasaltsstartindex];
        const alternatecondition = details[i][hasaltsstartindex + 1];

        const item = document.createElement("div");
        item.className = "details-item";
        item.innerHTML = `${alternateline} <span>(condition: ${alternatecondition})</span>`;
        altsList.appendChild(item);
      }
      altsDiv.appendChild(altsList);
      container.appendChild(altsDiv);
    }

    // checks
    if (hascheck > 0) {
      isred = details[0][15];
      difficulty = details[0][16];
      flagname = details[0][17];
      forced = details[0][18];
      skilltype = details[0][19];

      // check details in a table
      const checkDiv = document.createElement("div");
      const checkHeader = document.createElement("div");
      checkHeader.className = "details-section-header";
      checkHeader.textContent = "Checks";
      checkDiv.appendChild(checkHeader);

      const convoTable = document.createElement("table");
      convoTable.className = "details-table";

      const checkRows = [
        ["Is Red Check", isred || "(none)"],
        ["Difficulty", difficulty || "(none)"],
        ["Flag Name", flagname || "(none)"],
        ["Is Forced", forced || "(none)"],
        ["Skilltype", skilltype || "(none)"],
      ];

      checkRows.forEach(([label, value]) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.textContent = label;
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(th);
        tr.appendChild(td);
        convoTable.appendChild(tr);
      });
      checkDiv.appendChild(convoTable);
      container.appendChild(checkDiv);
    }

    // links (parents/children) — use schema columns
    // parents: dlinks where destination == this entry
    const parentsList = document.createElement("div");
    parentsList.className = "details-list";

    for (let i = 0; i < resultCount; i++) {
      const p_originconversationidp_oc = details[i][7];
      const p_origindialogueidp_oi = details[i][8];
      const p_priorityp_priority = details[i][9];
      const p_isConnectorp_isConnector = details[i][10];
      if (p_originconversationidp_oc == null) {
        continue;
      }
      const item = document.createElement("div");
      item.className = "details-item";
      item.textContent = `${p_originconversationidp_oc}:${p_origindialogueidp_oi} (priority: ${p_priorityp_priority}, connector: ${p_isConnectorp_isConnector})`;
      parentsList.appendChild(item);
    }

    const parentsDiv = document.createElement("div");
    const parentsHeader = document.createElement("div");
    parentsHeader.className = "details-section-header";
    parentsHeader.textContent = "Parents";
    parentsDiv.appendChild(parentsHeader);
    if (parentsList.length > 0) {
      parentsDiv.appendChild(parentsList);
    } else {
      const item = document.createElement("div");
      item.textContent = "(none)";
      item.className = "details-item";
      item.style.marginLeft = "4px"
      parentsDiv.style.display = "flex"
      parentsDiv.style.alignItems = "center"
      parentsDiv.appendChild(item);
    }
    container.appendChild(parentsDiv);

    // children: dlinks where origin == this entry

    const childrenList = document.createElement("div");
    childrenList.className = "details-list";

    for (let i = 0; i < resultCount; i++) {
      const c_destinationconversationidc_dc = details[i][11];
      const c_destinationdialogueidc_di = details[i][12];
      const c_priorityc_priority = details[i][13];
      const c_isConnectorc_isConnector = details[i][14];
      if (c_destinationconversationidc_dc == null) {
        continue;
      }
      const item = document.createElement("div");
      item.className = "details-item";
      item.textContent = `${c_destinationconversationidc_dc}:${c_destinationdialogueidc_di} (priority: ${c_priorityc_priority}, connector: ${c_isConnectorc_isConnector})`;
      childrenList.appendChild(item);
    }

    const childrenDiv = document.createElement("div");
    const childrenHeader = document.createElement("div");
    childrenHeader.className = "details-section-header";
    childrenHeader.textContent = "Children";
    childrenDiv.appendChild(childrenHeader);
    if (childrenList.length > 0) {
      childrenDiv.appendChild(childrenList);
    } else {
      const item = document.createElement("div");
      item.className = "details-item";
      item.textContent = "(none)";
      item.style.marginLeft = "4px"
      childrenDiv.style.display = "flex"
      childrenDiv.style.alignItems = "center"
      childrenDiv.appendChild(item);
    }
    container.appendChild(childrenDiv);

    // Conversation details in a table
    const convoDiv = document.createElement("div");
    const convoHeader = document.createElement("div");
    convoHeader.className = "details-section-header";
    convoHeader.textContent = "Conversation";
    convoDiv.appendChild(convoHeader);

    const convoTable = document.createElement("table");
    convoTable.className = "details-table";

    const convoRows = [
      ["ID", convoID || "(none)"],
      ["Title", d_titlec_title || "(none)"],
      ["Description", d_descriptionc_desc || "(none)"],
      ["Actor ID", d_actorc_actorid || "(none)"],
      ["Actor Name", a2_namec_actorname || "(none)"],
      ["Conversant Actor Id", d_conversantc_conversant_actorid || "(none)"],
      ["Conversant Actor Name", a3_nameconversant_actorname || "(none)"],
    ];

    convoRows.forEach(([label, value]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = label;
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(th);
      tr.appendChild(td);
      convoTable.appendChild(tr);
    });
    convoDiv.appendChild(convoTable);
    container.appendChild(convoDiv);

    // extra info in a table
    const exDiv = document.createElement("div");
    const metaHeader = document.createElement("div");
    metaHeader.className = "details-section-header";
    metaHeader.textContent = "Meta";
    exDiv.appendChild(metaHeader);

    const table = document.createElement("table");
    table.className = "details-table";

    const metaRows = [
      ["Sequence", sequence || "(none)"],
      ["Condition", conditionstring || "(none)"],
      ["Userscript", userscript || "(none)"],
      ["Difficulty", difficultypass || "(none)"],
    ];

    metaRows.forEach(([label, value]) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = label;
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(th);
      tr.appendChild(td);
      table.appendChild(tr);
    });

    exDiv.appendChild(table);
    container.appendChild(exDiv);

    entryDetailsEl.innerHTML = "";
    entryDetailsEl.appendChild(container);
  }

  async function searchDialogues(q) {
    if (!db) return;

    // Show loading indicator
    if (searchLoader) {
      searchLoader.style.display = "flex";
    }
    try {
      let hasWhereClause = false;

      q = q ? q.trim() : "";
      const safe = q.replace(/'/g, "''");
      let sql = `SELECT conversationid, id, dialoguetext, title, actor
                      FROM dentries`;
      if (q.length > 0) {
        sql += hasWhereClause ? " AND " : " WHERE ";
        sql += `  (dialoguetext LIKE '%${safe}%' 
        OR title LIKE '%${safe}%') `;
        hasWhereClause = true;
      }
      // Filter by actor if selected
      const selectedActorId = actorFilter?.value;
      if (selectedActorId) {
        sql += hasWhereClause ? " AND " : " WHERE ";
        sql += `actor='${selectedActorId}'`;
        hasWhereClause = true;
      }

      entryListHeaderEl.textContent = "Search Results";

      if (q.length <= minSearchLength) {
        sql += ` LIMIT ${searchResultLimit}`;
        entryListHeaderEl.textContent += ` limited to ${searchResultLimit} when under ${minSearchLength} characters.`;
      }

      sql += `;`;
      const res = db.exec(sql);

      entryListEl.innerHTML = "";

      // Collapse the current entry container when searching
      if (currentEntryContainerEl) {
        currentEntryContainerEl.style.visibility = "collapse";
      }

      if (!res || res.length === 0) {
        entryListEl.textContent = "(no matches)";
        entryListHeaderEl.textContent += ` (0)`;
        return;
      }

      if (q.length > minSearchLength) {
        entryListHeaderEl.textContent += ` (${res[0].values.length})`;
      }

      res[0].values.forEach((r) => {
        const [convoid, id, text, title, actor] = r;
        const div = document.createElement("div");
        div.className = "card-item";
        div.style.cursor = "pointer";

        const titleEl = document.createElement("div");
        titleEl.className = "card-title";
        titleEl.textContent = `${convoid}:${id}. ${title || "(no title)"}`;

        const textEl = document.createElement("div");
        textEl.className = "card-text";
        textEl.textContent = text || "";

        div.appendChild(titleEl);
        div.appendChild(textEl);

        div.addEventListener("click", () => {
          // When a search result is clicked, treat it like navigating to that entry
          resetNavigation(convoid);
          navigateToEntry(convoid, id);
          highlightConversationInTree(convoid);
        });
        entryListEl.appendChild(div);
      });
    } catch (e) {
      entryListEl.textContent = "Search error";
      console.error(e);
    } finally {
      // Hide loading indicator
      if (searchLoader) {
        searchLoader.style.display = "none";
      }
    }
  }

  if (searchBtn && searchInput)
    searchBtn.addEventListener("click", () =>
      searchDialogues(searchInput.value)
    );
  if (searchInput)
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") searchDialogues(searchInput.value);
    });

  // Also trigger search when actor filter changes
  if (actorFilter) {
    actorFilter.addEventListener("change", () => {
      if (searchInput.value) {
        searchDialogues(searchInput.value);
      }
    });
  }

  function updateBackButtonState() {
    if (backBtn) {
      backBtn.disabled = navigationHistory.length <= 1;
      if (backStatus) {
        backStatus.textContent =
          navigationHistory.length > 1
            ? `(${navigationHistory.length} steps)`
            : "";
      }
    }
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      goBack();
      updateBackButtonState();
    });
    updateBackButtonState(); // Initialize state
  }

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener("toggle", async function () {
      if (moreDetailsEl.open && currentConvoId && currentEntryId) {
        await showEntryDetails(currentConvoId, currentEntryId);
      } else {
        return;
      }
    });
  }
})();
