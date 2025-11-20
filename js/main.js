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
          console.log("Highlighted conversation", convoID, parentLabel);
          
          // Scroll the selected leaf into view
          try {
            leafLabel.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          } catch (e) {
            // Fallback for older browsers
            leafLabel.scrollIntoView();
          }
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
    const q = `SELECT dentries.id, dentries.title, dentries.dialoguetext, dentries.actor, 
                      actors.name as actor_name, dentries.conversationid, dentries.hascheck, 
                      dentries.hasalts, dentries.sequence, dentries.conditionstring, 
                      dentries.userscript, dentries.difficultypass 
                  FROM dentries 
                  LEFT JOIN actors ON dentries.actor=actors.id 
                  WHERE dentries.conversationid='${convoID}' 
                  AND dentries.id='${entryID}';`;
    const res = db.exec(q);
    if (!res || res.length === 0) {
      entryOverviewEl.textContent = "(not found)";
      entryDetailsEl.textContent = "(not found)";
      return;
    }
    const r = res[0].values[0];
    const [
      id,
      title,
      dialoguetext,
      actorid,
      actor_name,
      conversationid,
      hascheck,
      hasalts,
      sequence,
      conditionstring,
      userscript,
      difficultypass,
    ] = r;
    const container = document.createElement("div");

    try {
      const convoTitleDiv = document.createElement("div");
      convoTitleDiv.innerHTML = getDetailHtml("Title", title, "(no title)", id);
      container.appendChild(convoTitleDiv);

      const actorDiv = document.createElement("div");
      actorDiv.innerHTML = getDetailHtml(
        "Actor",
        actor_name,
        "(no actor)",
        actorid
      );
      container.appendChild(actorDiv);
    } catch (e) {
      /* ignore */
    }

    // alternates
    if (hasalts > 0) {
      const altQ = `SELECT alternates.alternateline, alternates.replaces 
                      FROM alternates 
                      WHERE alternates.conversationid='${convoID}' 
                      AND alternates.dialogueid='${entryID}';`;
      try {
        const altRes = db.exec(altQ);
        if (altRes && altRes.length) {
          const alts = altRes[0].values;
          const altsDiv = document.createElement("div");
          const altsHeader = document.createElement("div");
          altsHeader.className = "details-section-header";
          altsHeader.textContent = "Alternates";
          altsDiv.appendChild(altsHeader);

          const altsList = document.createElement("div");
          altsList.className = "details-list";
          alts.forEach((a) => {
            const item = document.createElement("div");
            item.className = "details-item";
            item.innerHTML = `${a[0]} <span style="color:#999; font-size:11px;">(replaces: ${a[1]})</span>`;
            altsList.appendChild(item);
          });
          altsDiv.appendChild(altsList);
          container.appendChild(altsDiv);
        }
      } catch (e) {
        /* ignore */
      }
    }

    // checks
    if (hascheck > 0) {
      try {
        const chkRes = db.exec(
          `SELECT * 
              FROM checks 
              WHERE conversationid='${convoID}' AND dialogueid='${entryID}';`
        );
        if (chkRes && chkRes.length) {
          const chks = chkRes[0];
          const chkDiv = document.createElement("div");
          const chkHeader = document.createElement("div");
          chkHeader.className = "details-section-header";
          chkHeader.textContent = "Checks";
          chkDiv.appendChild(chkHeader);

          const chkPre = document.createElement("pre");
          chkPre.className = "details-item";
          chkPre.style.whiteSpace = "pre-wrap";
          chkPre.style.backgroundColor = "#f5f5f5";
          chkPre.style.padding = "8px";
          chkPre.style.borderRadius = "4px";
          chkPre.style.borderLeft = "2px solid #ddd";
          chkPre.style.overflowX = "auto";
          chkPre.style.fontSize = "11px";
          chkPre.textContent = JSON.stringify(chks, null, 2);
          chkDiv.appendChild(chkPre);
          container.appendChild(chkDiv);
        }
      } catch (e) {
        /* ignore */
      }
    }

    try {
      const convoIdDiv = document.createElement("div");
      convoIdDiv.innerHTML = getDetailHtml("Converasation Id", conversationid);
      container.appendChild(convoIdDiv);
    } catch (e) {
      /* ignore */
    }

    // links (parents/children) — use schema columns
    try {
      // parents: dlinks where destination == this entry
      const parentsQ = `SELECT originconversationid as oc, origindialogueid as oi, priority, isConnector 
                          FROM dlinks 
                          WHERE destinationconversationid='${convoID}' 
                          AND destinationdialogueid='${entryID}'
                          ORDER BY priority DESC;`;
      const parentsRes = db.exec(parentsQ);
      if (parentsRes && parentsRes.length && parentsRes[0].values.length) {
        const parents = parentsRes[0].values;
        const parentsDiv = document.createElement("div");
        const parentsHeader = document.createElement("div");
        parentsHeader.className = "details-section-header";
        parentsHeader.textContent = "Parents";
        parentsDiv.appendChild(parentsHeader);

        const parentsList = document.createElement("div");
        parentsList.className = "details-list";
        parents.forEach((p) => {
          const item = document.createElement("div");
          item.className = "details-item";
          item.textContent = `${p[0]}:${p[1]} (priority: ${p[2]}, connector: ${p[3]})`;
          parentsList.appendChild(item);
        });
        parentsDiv.appendChild(parentsList);
        container.appendChild(parentsDiv);
      }

      // children: dlinks where origin == this entry
      const childrenQ = `SELECT destinationconversationid as dc, destinationdialogueid as di, priority, isConnector 
                            FROM dlinks 
                            WHERE originconversationid='${convoID}' 
                            AND origindialogueid='${entryID}
                            ORDER BY priority DESC';`;
      const childrenRes = db.exec(childrenQ);
      if (childrenRes && childrenRes.length && childrenRes[0].values.length) {
        const children = childrenRes[0].values;
        const childrenDiv = document.createElement("div");
        const childrenHeader = document.createElement("div");
        childrenHeader.className = "details-section-header";
        childrenHeader.textContent = "Children";
        childrenDiv.appendChild(childrenHeader);

        const childrenList = document.createElement("div");
        childrenList.className = "details-list";
        children.forEach((c) => {
          const item = document.createElement("div");
          item.className = "details-item";
          item.textContent = `${c[0]}:${c[1]} (priority: ${c[2]}, connector: ${c[3]})`;
          childrenList.appendChild(item);
        });
        childrenDiv.appendChild(childrenList);
        container.appendChild(childrenDiv);
      }
    } catch (e) {
      /* ignore */
    }

    // extra info in a table
    const exDiv = document.createElement("div");
    const metaHeader = document.createElement("div");
    metaHeader.className = "details-section-header";
    metaHeader.textContent = "Meta";
    exDiv.appendChild(metaHeader);

    const table = document.createElement("table");
    table.className = "details-table";

    const rows = [
      ["Sequence", sequence || "(none)"],
      ["Condition", conditionstring || "(none)"],
      ["Userscript", userscript || "(none)"],
      ["Difficulty", difficultypass || "(none)"],
    ];

    rows.forEach(([label, value]) => {
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
      const safe = q.replace(/'/g, "''");
      let sql = `SELECT conversationid, id, dialoguetext, title, actor
                      FROM dentries 
                      WHERE (dialoguetext LIKE '%${safe}%' 
                      OR title LIKE '%${safe}%')`;
      
      // Filter by actor if selected
      const selectedActorId = actorFilter?.value;
      if (selectedActorId) {
        sql += ` AND actor='${selectedActorId}'`;
      }
      
      sql += `;`;
      
      const res = db.exec(sql);
      entryListHeaderEl.textContent = "Search Results";
      entryListEl.innerHTML = "";

      // Collapse the current entry container when searching
      if (currentEntryContainerEl) {
        currentEntryContainerEl.style.visibility = "collapse";
      }

      if (!res || res.length === 0) {
        entryListEl.textContent = "(no matches)";
        return;
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
