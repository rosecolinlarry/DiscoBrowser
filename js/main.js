// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import * as DB from "./db.js";
import { buildTitleTree, renderTree } from "./treeBuilder.js";
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
const rootBtn = UI.$("rootBtn");
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
      const convoId = parseInt(target.dataset.convoId, 10);
      loadEntriesForConversation(convoId, true);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const convoId = parseInt(topLabel.dataset.singleConvo, 10);
      loadEntriesForConversation(convoId, true);
    }
  });

  // Handle custom convoLeafClick events from tree builder
  convoListEl.addEventListener("convoLeafClick", (e) => {
    const convoId = e.detail.convoId;
    loadEntriesForConversation(convoId, true);
    highlightConversationInTree(convoId);
  });

  // Handle navigateToConversation events from history dividers
  if (chatLogEl) {
    chatLogEl.addEventListener("navigateToConversation", (e) => {
      const convoId = e.detail.convoId;
      loadEntriesForConversation(convoId, true);
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
      if (ev.key === "Enter")
        searchDialogues(searchInput.value, minSearchLength, searchResultLimit);
    });
  }
  if (actorFilter)
    actorFilter.addEventListener("change", () => {
      if (searchInput.value)
        searchDialogues(searchInput.value, minSearchLength, searchResultLimit);
    });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      goBack();
      updateBackButtonState();
    });
  }
  
  if (rootBtn) {
    rootBtn.addEventListener("click", () => {
      if (currentConvoId !== null) {
        jumpToConversationRoot();
      }
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

// convoId = number
function highlightConversationInTree(convoId) {
  // TODO KA not being called for smoker
  // Remove highlight from all labels (both leaf and node labels)
  const allLabels = convoListEl.querySelectorAll(".label.selected");
  allLabels.forEach((label) => {
    label.classList.remove("selected");
  });

  // Find the leaf with data-convo-id
  let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoId}"]`);

  if (leafLabel) {
    // Highlight the leaf label itself
    // leafLabel.classList.add("selected");
    // Walk up the tree and expand all ancestor nodes
    let node = leafLabel.closest(".node").querySelector(".label");
    node.classList.add("selected");
    node.scrollIntoView();

    // Move up one level
    node = node.parentElement.parentElement.closest(".node");
    while (node) {
      node.classList.add("expanded");
      // Update toggle text
      const toggle = node.querySelector(":scope > .label > .toggle");
      if (toggle && toggle.textContent === "▸") {
        toggle.textContent = "▾";
      }

      // Move up one level
      node = node.parentElement?.closest(".node");
    }
  }
}

/* Load entries listing for conversation */
function loadEntriesForConversation(convoId, resetHistory = false) {
  convoId = parseInt(convoId, 10);
  
  // If switching conversations or resetting, clear the chat log
  if (resetHistory || (currentConvoId !== null && currentConvoId !== convoId)) {
    navigationHistory = [{ convoId, entryId: null }];
    if (chatLogEl) {
      chatLogEl.innerHTML = "";
    }
  } else if (resetHistory) {
    navigationHistory = [{ convoId, entryId: null }];
  }
  
  if (currentEntryContainerEl) currentEntryContainerEl.style.display = "flex";
  
  // Update current state for conversation root
  currentConvoId = convoId;
  currentEntryId = null;
  
  // Hide root button at conversation root
  if (rootBtn) {
    rootBtn.style.display = "none";
  }
  
  // Show conversation metadata instead of entry details
  const conversation = DB.getConversationById(convoId);
  if (conversation) {
    UI.renderConversationOverview(entryOverviewEl, conversation);
  }
  
  // Show "(no details)" in More Details section for conversation overview
  if (entryDetailsEl) {
    entryDetailsEl.innerHTML = "<div class='hint-text'>(no details)</div>";
  }
  
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
    const entryId = parseInt(r.id, 10);
    const title = r.title && r.title.trim() ? r.title : "(no title)";

    const text = r.dialoguetext || "";
    const el = UI.createCardItem(`${convoId}:${entryId}. ${UI.parseSpeakerFromTitle(title)}`,text,false);
    el.addEventListener("click", () => navigateToEntry(convoId, entryId));
    entryListEl.appendChild(el);
  });
}

/* Navigation / history functions */
function updateBackButtonState() {
  if (!backBtn) return;
  backBtn.disabled = navigationHistory.length <= 1;
  if (backStatus) {
    if (navigationHistory.length > 1) {
      backStatus.textContent = `(${navigationHistory.length - 1} step${navigationHistory.length - 1 !== 1 ? 's' : ''})`;
    } else {
      backStatus.textContent = "";
    }
  }
}

async function goBack() {
  if (navigationHistory.length <= 1) return;
  
  // Pop the current entry from history
  navigationHistory.pop();
  
  // Get the previous entry (now at the end of the array)
  const previous = navigationHistory[navigationHistory.length - 1];
  if (previous) {
    const cid = parseInt(previous.convoId, 10);
    
    // If entryId is null, we're going back to the conversation root
    if (previous.entryId === null) {
      loadEntriesForConversation(cid, false);
      highlightConversationInTree(cid);
      updateBackButtonState();
      return;
    }
    
    // Update current state
    currentConvoId = cid;
    currentEntryId = parseInt(previous.entryId, 10);
    
    // Update the UI to show this entry
    const coreRow = DB.getEntry(currentConvoId, currentEntryId);
    const title = coreRow ? UI.parseSpeakerFromTitle(coreRow.title) || "(no title)" : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext);
    
    // Load child options
    loadChildOptions(currentConvoId, currentEntryId);
    
    // Show details if expanded
    if (moreDetailsEl && moreDetailsEl.open) {
      await showEntryDetails(currentConvoId, currentEntryId);
    }
  }
  
  updateBackButtonState();
}

/* Jump back to a specific point in history by removing all entries after it */
async function jumpToHistoryPoint(targetIndex) {
  if (targetIndex < 0 || targetIndex >= navigationHistory.length) return;
  
  // If clicking on the last item, do nothing (it's about to become current anyway)
  if (targetIndex === navigationHistory.length - 1) return;
  
  // Remove all chat log items after the target
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll(".card-item");
    const itemsToRemove = historyItems.length - targetIndex;
    for (let i = 0; i < itemsToRemove; i++) {
      if (historyItems[historyItems.length - 1 - i]) {
        historyItems[historyItems.length - 1 - i].remove();
      }
    }
  }
  
  // Remove entries from navigation history after the target
  navigationHistory.splice(targetIndex + 1);
  
  // Get the target entry
  const target = navigationHistory[targetIndex];
  if (target) {
    const cid = parseInt(target.convoId, 10);
    const eid = parseInt(target.entryId, 10);
    
    // Update current state
    currentConvoId = cid;
    currentEntryId = eid;
    
    // Update the UI
    const coreRow = DB.getEntry(currentConvoId, currentEntryId);
    const title = coreRow ? coreRow.title || "(no title)" : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext);
    
    // Load child options
    loadChildOptions(currentConvoId, currentEntryId);
    
    // Show details if expanded
    if (moreDetailsEl && moreDetailsEl.open) {
      await showEntryDetails(currentConvoId, currentEntryId);
    }
  }
  
  updateBackButtonState();
}

/* Jump to conversation root */
function jumpToConversationRoot() {
  if (currentConvoId === null) return;
  
  // Clear all entries except the first one (conversation root)
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll(".card-item");
    historyItems.forEach(item => item.remove());
  }
  
  // Reset to just the conversation root
  navigationHistory = [{ convoId: currentConvoId, entryId: null }];
  
  // Load the conversation root
  loadEntriesForConversation(currentConvoId, false);
  highlightConversationInTree(currentConvoId);
  updateBackButtonState();
}

/* navigateToEntry simplified */
async function navigateToEntry(convoId, entryId, addToHistory = true) {
  // Ensure numeric Ids
  convoId = parseInt(convoId, 10);
  entryId = parseInt(entryId, 10);

  // Check if we're already at this entry - if so, do nothing
  // BUT allow if we're not adding to history (going back)
  if (currentConvoId === convoId && currentEntryId === entryId && addToHistory) {
    return;
  }

  // Make visible
  if (currentEntryContainerEl)
    currentEntryContainerEl.style.visibility = "visible";

  // Clear the hint text if present
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes("(navigation log")
    )
      chatLogEl.innerHTML = "";
  }

  // If we have a previous entry, add it to the log (if not already there)
  if (addToHistory && currentConvoId !== null && currentEntryId !== null && chatLogEl) {
    // Add the previous current entry to the log before moving to the new one
    const prevHistoryIndex = navigationHistory.length;
    const coreRow = DB.getEntry(currentConvoId, currentEntryId);
    const title = coreRow ? UI.parseSpeakerFromTitle(coreRow.title) || "(no title)" : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    UI.appendHistoryItem(
      chatLogEl,
      `${title} — #${currentEntryId}`,
      dialoguetext,
      prevHistoryIndex - 1,
      () => {
        // Jump back to this history point
        jumpToHistoryPoint(prevHistoryIndex - 1);
      }
    );
  }

  if (addToHistory) navigationHistory.push({ convoId, entryId });
  updateBackButtonState();

  // Render current entry in the overview section
  const coreRow = DB.getEntry(convoId, entryId);
  const title = coreRow
    ? UI.parseSpeakerFromTitle(coreRow.title) || "(no title)"
    : `(line ${convoId}:${entryId})`;
  const dialoguetext = coreRow ? coreRow.dialoguetext : "";
  UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext);

  currentConvoId = convoId;
  currentEntryId = entryId;
  
  // Show/hide root button
  if (rootBtn) {
    rootBtn.style.display = currentEntryId !== null ? "inline-block" : "none";
  }

  // Load child options
  loadChildOptions(convoId, entryId);

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
  const alternates =
    entry.hasalts > 0 ? DB.getAlternates(convoId, entryId) : [];
  const checks = entry.hascheck > 0 ? DB.getChecks(convoId, entryId) : [];
  const { parents, children } = DB.getParentsChildren(convoId, entryId);
  // Get conversation data
  const convoRow = DB.getConversationById(convoId) || {};
  // Get actor names
  let entryActorName = DB.getActorNameById(entry.actor);
  let convoActorName = DB.getActorNameById(convoRow.actor);
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
      entryListEl.textContent =
        "(Please enter a search term to find dialogues)";
      entryListHeaderEl.textContent += " (0)";
      if (currentEntryContainerEl)
        currentEntryContainerEl.style.visibility = "collapse";
      return;
    }

    const res = DB.searchDialogues(
      trimmedQ,
      minSearchLength,
      searchResultLimit,
      actorId
    );
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
        `${r.conversationid}:${r.id}. ${UI.parseSpeakerFromTitle(r.title) || "(no title)"}`,
        trimmedQ
      );

      const highlightedText = UI.highlightTerms(r.dialoguetext || "", trimmedQ);

      const div = UI.createCardItem(highlightedTitle, highlightedText, true);

      div.addEventListener("click", () => {
        const cid = parseInt(r.conversationid, 10);
        const eid = parseInt(r.id, 10);
        navigationHistory = [{ convoId: cid, entryId: null }];
        navigateToEntry(cid, eid);
        highlightConversationInTree(cid);
        document.querySelector(".selected").scrollIntoView(true);
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

function loadChildOptions(convoId, entryId) {
  try {
    entryListHeaderEl.textContent = "Next Dialogue Options";
    entryListEl.innerHTML = "";

    const { children } = DB.getParentsChildren(convoId, entryId);

    const pairs = [];
    for (const c of children)
      pairs.push({ convoId: c.d_convo, entryId: c.d_id });
    
    const destRows = DB.getEntriesBulk(pairs);
    const destMap = new Map(destRows.map((r) => [`${r.convo}:${r.id}`, r]));

    for (const c of children) {
      const dest = destMap.get(`${c.d_convo}:${c.d_id}`);
      if (!dest) continue;
      if ((dest.title || "").toLowerCase() === "start") continue;

      const title = dest.title?.trim() || "(no title)";
      const display = `${c.d_convo}:${c.d_id}. ${UI.parseSpeakerFromTitle(title)}`;
      const summary = dest.dialoguetext || "";

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
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
