// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import * as DB from "./db.js";
import { buildTitleTree, renderTree, findAndExpandConversation } from "./treeBuilder.js";
import * as UI from "./ui.js";

const searchInput = UI.$("search");
const searchBtn = UI.$("searchBtn");
const actorFilter = UI.$("actorFilter");
const searchLoader = UI.$("searchLoader");
const convoListEl = UI.$("convoList");
const entryListEl = UI.$("entryList");
const entryListHeaderEl = UI.$("entryListHeader");
const entryDetailsEl = UI.$("entryDetails");
const entryOverviewEl = UI.$("entryOverview");
const currentEntryContainerEl = UI.$("currentEntryContainer");
const chatLogEl = UI.$("chatLog");
const backBtn = UI.$("backBtn");
const backStatus = UI.$("backStatus");
const moreDetailsEl = UI.$("moreDetails");

const minSearchLength = 3;
const searchResultLimit = 1000;

let navigationHistory = [];
let currentConvoId = null;
let currentEntryId = null;

async function boot() {
  const SQL = await loadSqlJs();
  await DB.initDatabase(SQL, "db/discobase.sqlite3");

  // load conversations & populate actor dropdown
  const convos = DB.getAllConversations();
  // filter dead-ends quickly
  const filtered = convos.filter((c) => !DB.isDeadEndConversation(c.id));
  // Build tree and render
  const tree = buildTitleTree(filtered);
  renderTree(convoListEl, tree);

  // event delegation: clicks in convoList
  convoListEl.addEventListener("click", (e) => {
    const target = e.target.closest("[data-convo-id]");
    if (target) {
      const id = parseInt(target.dataset.convoId, 10);
      loadEntriesForConversation(id);
      highlightConversationInTree(id);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const id = parseInt(topLabel.dataset.singleConvo, 10);
      loadEntriesForConversation(id);
    }
  });

  // Handle custom convoLeafClick events from tree builder
  convoListEl.addEventListener("convoLeafClick", (e) => {
    const convoId = e.detail.convoId;
    loadEntriesForConversation(convoId);
    highlightConversationInTree(convoId);
  });

  // Handle navigateToConversation events from history dividers
  if (chatLogEl) {
    chatLogEl.addEventListener("navigateToConversation", (e) => {
      const convoId = e.detail.convoId;
      loadEntriesForConversation(convoId);
      highlightConversationInTree(convoId);
    });
  }

  // actor dropdown
  populateActorDropdown();

  // wire search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () =>
      searchDialogues(searchInput.value, minSearchLength, searchResultLimit)
    );
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") searchDialogues(searchInput.value, minSearchLength, searchResultLimit);
    });
  }
  if (actorFilter)
    actorFilter.addEventListener("change", () => {
      if (searchInput.value) searchDialogues(searchInput.value, minSearchLength, searchResultLimit);
    });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      goBack();
      updateBackButtonState();
    });
  }
  updateBackButtonState();

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener("toggle", async function () {
      if (moreDetailsEl.open && currentConvoId && currentEntryId) {
        await showEntryDetails(currentConvoId, currentEntryId);
      }
    });
  }
}

async function populateActorDropdown() {
  const actors = DB.getDistinctActors();
  actorFilter.innerHTML = `<option value="">All Actors</option>`;
  actors.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.name;
    actorFilter.appendChild(opt);
  });
}
function highlightConversationInTree(convoId) {
  console.log(`[HIGHLIGHT] Looking for conversation ${convoId}`);
  
  // Remove old highlights
  convoListEl.querySelectorAll(".label.selected")
    .forEach(el => el.classList.remove("selected"));

  // Set up callback for when tree builder finds the label
  window._onConvoFound = (label, foundConvoId) => {
    console.log(`[HIGHLIGHT] Callback: Label found for ${foundConvoId}`, label);
    applyHighlight(label);
    delete window._onConvoFound;
  };

  // Use the imported tree builder helper function
  const label = findAndExpandConversation(convoId);
  
  if (label) {
    console.log(`[HIGHLIGHT] Got label immediately`);
    applyHighlight(label);
  }

  function applyHighlight(label) {
    console.log(`[HIGHLIGHT] Applying highlight to label`);
    label.classList.add("selected");
    label.scrollIntoView({ block: "nearest" });

    // Expand all ancestor nodes (in case they weren't already)
    let current = label;
    while (current) {
      const ancestorNode = current.closest(".node");
      if (!ancestorNode) break;

      ancestorNode.classList.add("expanded");
      const toggle = ancestorNode.querySelector(":scope > .label > .toggle");
      if (toggle) toggle.textContent = "▾";

      current = ancestorNode;
    }
    
    console.log(`[HIGHLIGHT] Highlighting complete`);
  }
}


/* Load entries listing for conversation */
function loadEntriesForConversation(convoId, resetHistory = true) {
  convoId = parseInt(convoId, 10);
  // Only reset history if this is a fresh navigation (e.g., from search or tree click)
  if (resetHistory) {
    navigationHistory = [{ convoId, entryId: null }];
  } else {
    // Check if we're switching to a different conversation; if so, add a visual divider
    if (navigationHistory.length > 0) {
      const lastEntry = navigationHistory[navigationHistory.length - 1];
      if (lastEntry.convoId !== convoId) {
        // Add a divider marker to the history
        navigationHistory.push({ convoId: null, entryId: null, isDivider: true });
      }
    }
  }
  if (currentEntryContainerEl) currentEntryContainerEl.style.display = "flex";
  const rows = DB.getEntriesForConversation(convoId);
  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";
  const filtered = rows.filter(
    (r) => (r.title || "").toLowerCase() !== "start"
  );
  if (!filtered.length) {
    entryListEl.textContent = "(no meaningful entries - only START)";
    return;
  }
  filtered.forEach((r) => {
    const id = parseInt(r.id, 10);
    const title = r.title && r.title.trim() ? r.title : "(no title)";

    const text = r.dialoguetext || "";
    const el = UI.createCardItem(
      `${convoId}:${id}. ${title}`,
      text.substring(0, 300),
      false
    );
    el.addEventListener("click", () => navigateToEntry(convoId, id));
    entryListEl.appendChild(el);
  });
}

/* Navigation / history functions */
function updateBackButtonState() {
  if (!backBtn) return;
  backBtn.disabled = navigationHistory.length <= 1;
  if (backStatus) {
    backStatus.textContent =
      navigationHistory.length > 1 ? `(${navigationHistory.length} steps)` : "";
  }
}

function goBack() {
  if (navigationHistory.length <= 1) return;
  navigationHistory.pop();
  
  // Skip dividers and find the last real entry
  while (navigationHistory.length > 0) {
    const previous = navigationHistory[navigationHistory.length - 1];
    if (!previous.isDivider && previous.entryId) {
      const cid = parseInt(previous.convoId, 10);
      const eid = parseInt(previous.entryId, 10);
      navigateToEntry(cid, eid, false);
      return;
    }
    navigationHistory.pop();
  }
}

/* navigateToEntry optimized */
async function navigateToEntry(convoId, entryId, addToHistory = true) {
  // Ensure numeric Ids
  convoId = parseInt(convoId, 10);
  entryId = parseInt(entryId, 10);

  // Make visible
  if (currentEntryContainerEl)
    currentEntryContainerEl.style.visibility = "visible";

  // small cache first
  const cached = DB.getCachedEntry(convoId, entryId);
  
  // Check if we're switching conversations BEFORE adding to history
  let shouldAddDivider = false;
  if (addToHistory && navigationHistory.length > 0) {
    const lastEntry = navigationHistory[navigationHistory.length - 1];
    if (lastEntry && lastEntry.convoId && lastEntry.convoId !== convoId && !lastEntry.isDivider) {
      shouldAddDivider = true;
    }
  }
  
  if (addToHistory) navigationHistory.push({ convoId, entryId });
  updateBackButtonState();

  // Append chat log entry
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes("(navigation log")
    )
      chatLogEl.innerHTML = "";
    
    // Add divider if switching conversations
    if (shouldAddDivider) {
      UI.appendHistoryDivider(chatLogEl, convoId);
    }
    
    const historyIndex = navigationHistory.length - 1;
    const coreRow = DB.getEntry(convoId, entryId);
    const title = coreRow
      ? coreRow.title || "(no title)"
      : `(line ${convoId}:${entryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    const item = UI.appendHistoryItem(
      chatLogEl,
      `${title} — #${entryId}`,
      dialoguetext,
      historyIndex,
      () => {
        if (item.dataset.isCurrent === "true") return;
        jumpToHistoryPoint(historyIndex);
      }
    );
    // mark current
    const allItems = chatLogEl.querySelectorAll(".card-item");
    allItems.forEach((el) => {
      el.dataset.isCurrent = "false";
      el.style.opacity = "1";
      el.style.cursor = "pointer";
    });
    item.dataset.isCurrent = "true";
    item.style.opacity = "0.7";
    item.style.cursor = "default";

    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext);
  }

  currentConvoId = convoId;
  currentEntryId = entryId;

  // Highlight and expand conversation in tree (do this after setting currentConvoId)
  setTimeout(() => {
    highlightConversationInTree(convoId);
  }, 0);

  // Load child links (parents/children) and render options
  // Use DB.getParentsChildren which is optimized
  try {
    entryListHeaderEl.textContent = "Next Dialogue Options";
    entryListEl.innerHTML = "";

    // get children via DB.getParentsChildren
    const { parents, children } = DB.getParentsChildren(convoId, entryId);

    // Build a list of destination pairs to fetch in batch, to avoid many queries
    const pairs = [];
    for (const c of children) pairs.push({ convoId: c.d_convo, entryId: c.d_id });
    // But skip START entries when rendering
    const destRows = DB.getEntriesBulk(pairs);
    // Map by key
    const destMap = new Map(destRows.map((r) => [`${r.convo}:${r.id}`, r]));

    for (const c of children) {
      const dest = destMap.get(`${c.d_convo}:${c.d_id}`);
      if (!dest) continue;

      if ((dest.title || "").toLowerCase() === "start") continue;

      const title = dest.title?.trim() || "(no title)";
      const display = `${c.d_convo}:${c.d_id}. ${title}`;
      const summary = dest.dialoguetext?.substring(0, 200) || "";

      const el = UI.createCardItem(display, summary, false);
      el.addEventListener("click", () => navigateToEntry(c.d_convo, c.d_id));
      entryListEl.appendChild(el);
    }

    if (entryListEl.children.length === 0)
      entryListEl.textContent = "(no further options)";
  } catch (e) {
    console.error("Error loading child links", e);
    entryListEl.textContent = "(error loading next options)";
  }

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    await showEntryDetails(convoId, entryId);
  }
}

/* Show entry details (optimized) */
async function showEntryDetails(convoId, entryId) {
  if (!DB || !entryDetailsEl) return;

  // Check cache
  const cached = DB.getCachedEntry(convoId, entryId);
  if (cached) {
    UI.renderEntryDetails(entryDetailsEl, {
      ...cached,
      onNavigate: navigateToEntry,
    });
    return;
  }

  // core row
  const entry = DB.getEntry(convoId, entryId);
  if (!entry) {
    entryDetailsEl.textContent = "(not found)";
    return;
  }

  // Fetch alternates, checks, parents/children
  const alternates = entry.hasalts > 0 ? DB.getAlternates(convoId, entryId) : [];
  const checks = entry.hascheck > 0 ? DB.getChecks(convoId, entryId) : [];
  const { parents, children } = DB.getParentsChildren(convoId, entryId);
  // Get conversation data
  const convoRow = DB.getConversationById(convoId) || {};
  // Get actor names
  let entryActorName = DB.getActorNameById(entry.actor)
  let convoActorName =  DB.getActorNameById(convoRow.actor)
  let convoConversantActorName = DB.getActorNameById(convoRow.conversant);

  const payload = {
    convoId: convoId,
    entryId: entryId,
    title: entry.title,
    actorId: entry.actor,
    actorName: entryActorName,
    alternates,
    checks,
    parents,
    children,
    conversationTitle: convoRow.title,
    conversationDescription: convoRow.description,
    conversationActorId: convoRow.actor,
    conversationActorName: convoActorName,
    conversationConversantId: convoRow.conversant,
    conversationConversantName: convoConversantActorName,
    sequence: entry.sequence,
    conditionstring: entry.conditionstring,
    userscript: entry.userscript,
    difficultypass: entry.difficultypass,
    onNavigate: navigateToEntry,
  };

  // Cache it
  DB.cacheEntry(convoId, entryId, payload);

  UI.renderEntryDetails(entryDetailsEl, payload);
}

/* Search */
function searchDialogues(q) {
  const trimmedQ = q.trim();
  if (searchLoader) searchLoader.style.display = "flex";
  try {
    const actorId = actorFilter?.value || null;
    
    // Check if search query is empty
    if (!trimmedQ) {
      entryListHeaderEl.textContent = "Search Results";
      entryListEl.innerHTML = "";
      entryListEl.textContent = "(Please enter a search term to find dialogues)";
      entryListHeaderEl.textContent += " (0)";
      if (currentEntryContainerEl)
        currentEntryContainerEl.style.visibility = "collapse";
      return;
    }
    
    const res = DB.searchDialogues(trimmedQ, minSearchLength, searchResultLimit, actorId);
    entryListHeaderEl.textContent = "Search Results";
    entryListEl.innerHTML = "";
    if (!res.length) {
      entryListEl.textContent = "(no matches)";
      entryListHeaderEl.textContent += " (0)";
      if (currentEntryContainerEl)
        currentEntryContainerEl.style.visibility = "collapse";
      return;
    }
    entryListHeaderEl.textContent += ` (${res.length})`;
    res.forEach((r) => {
      const highlightedTitle = UI.highlightTerms(
        `${r.conversationid}:${r.id}. ${r.title || "(no title)"}`,
        trimmedQ
      );

      const highlightedText = UI.highlightTerms(r.dialoguetext || "", trimmedQ);

      const div = UI.createCardItem(highlightedTitle, highlightedText, true);

      div.addEventListener("click", () => {
        const cid = parseInt(r.conversationid, 10);
        const eid = parseInt(r.id, 10);
        navigationHistory = [{ convoId: cid, entryId: null }];
        navigateToEntry(cid, eid);
      });
      entryListEl.appendChild(div);
    });
    if (currentEntryContainerEl)
      currentEntryContainerEl.style.visibility = "collapse";
  } catch (e) {
    console.error("Search error", e);
    entryListEl.textContent = "Search error";
  } finally {
    if (searchLoader) searchLoader.style.display = "none";
  }
}

function jumpToHistoryPoint(historyIndex) {
  if (historyIndex < 0 || historyIndex >= navigationHistory.length) return;
  
  // Find the actual entry at or before this index (skip dividers)
  let actualIndex = historyIndex;
  while (actualIndex >= 0) {
    const target = navigationHistory[actualIndex];
    if (target && !target.isDivider && target.entryId) {
      navigationHistory = navigationHistory.slice(0, actualIndex + 1);
      const cid = parseInt(target.convoId, 10);
      const eid = parseInt(target.entryId, 10);
      navigateToEntry(cid, eid, false);
      return;
    }
    actualIndex--;
  }
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
