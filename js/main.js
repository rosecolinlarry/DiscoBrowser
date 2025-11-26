// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import * as DB from "./db.js";
import { buildTitleTree, renderTree } from "./treeBuilder.js";
import * as UI from "./ui.js";

const searchInput = UI.$("search");
const searchBtn = UI.$("searchBtn");
const actorFilterBtn = UI.$("actorFilterBtn");
const actorFilterLabel = UI.$("actorFilterLabel");
const actorFilterDropdown = UI.$("actorFilterDropdown");
const actorSearchInput = UI.$("actorSearch");
const actorCheckboxList = UI.$("actorCheckboxList");
const selectAllActors = UI.$("selectAllActors");
const addToSelectionBtn = UI.$("addToSelection");
const searchLoader = UI.$("searchLoader");
const convoListEl = UI.$("convoList");
const convoSearchInput = UI.$("convoSearch");
const convoTypeFilterBtns = document.querySelectorAll(".type-filter-btn");
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
let conversationTree = null;
let activeTypeFilter = "all";
let allActors = [];
let selectedActorIds = new Set();
let filteredActors = [];

async function boot() {
  const SQL = await loadSqlJs();
  await DB.initDatabase(SQL, "db/discobase.sqlite3");

  // load conversations & populate actor dropdown
  const convos = DB.getAllConversations();
  // Build tree and render (includes all types: flow, orb, task)
  conversationTree = buildTitleTree(convos);
  renderTree(convoListEl, conversationTree);

  // Set up conversation filter
  setupConversationFilter();

  // event delegation: clicks in convoList
  convoListEl.addEventListener("click", (e) => {
    const target = e.target.closest("[data-convo-id]");
    if (target) {
      const convoId = UI.getParsedIntOrDefault(target.dataset.convoId);
      loadEntriesForConversation(convoId, true);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const convoId = UI.getParsedIntOrDefault(topLabel.dataset.singleConvo);
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

function setupConversationFilter() {
  // Text search filter
  if (convoSearchInput) {
    convoSearchInput.addEventListener("input", () => {
      filterConversationTree();
    });
  }

  // Type filter buttons
  convoTypeFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Update active state
      convoTypeFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Update active filter
      activeTypeFilter = btn.dataset.type;
      
      // Apply filter
      filterConversationTree();
    });
  });
}

function filterConversationTree() {
  if (!conversationTree) return;
  
  const searchText = convoSearchInput ? convoSearchInput.value.toLowerCase().trim() : "";
  
  // If no filters active, render the original tree
  if (!searchText && activeTypeFilter === "all") {
    renderTree(convoListEl, conversationTree);
    if (currentConvoId !== null) {
      highlightConversationInTree(currentConvoId);
    }
    return;
  }
  
  // Filter the tree root
  const filteredRoot = filterTreeNode(conversationTree.root, searchText, activeTypeFilter);
  
  // Create filtered tree object with original metadata
  const filteredTree = {
    root: filteredRoot,
    convoTitleById: conversationTree.convoTitleById,
    convoTypeById: conversationTree.convoTypeById
  };
  
  // Re-render the tree
  renderTree(convoListEl, filteredTree);
  
  // Re-highlight current conversation if it exists
  if (currentConvoId !== null) {
    highlightConversationInTree(currentConvoId);
  }
}

function filterTreeNode(node, searchText, typeFilter) {
  // Clone the node to avoid modifying the original
  const filtered = {
    segment: node.segment,
    children: new Map(),
    convoIds: [],
    _subtreeSize: 0
  };
  
  // Filter conversation IDs
  if (node.convoIds && node.convoIds.length > 0) {
    filtered.convoIds = node.convoIds.filter(cid => {
      const convo = DB.getConversationById(cid);
      if (!convo) return false;
      
      // Type filter
      if (typeFilter !== "all" && convo.type !== typeFilter) {
        return false;
      }
      
      // Text filter
      if (searchText) {
        const titleMatch = convo.title.toLowerCase().includes(searchText);
        const idMatch = cid.toString().includes(searchText);
        return titleMatch || idMatch;
      }
      
      return true;
    });
  }
  
  // Recursively filter children
  if (node.children) {
    for (const [key, child] of node.children) {
      const filteredChild = filterTreeNode(child, searchText, typeFilter);
      // Only include children that have matches
      if (filteredChild.convoIds.length > 0 || filteredChild.children.size > 0) {
        filtered.children.set(key, filteredChild);
        filtered._subtreeSize += filteredChild._subtreeSize || filteredChild.convoIds.length;
      }
    }
  }
  
  filtered._subtreeSize += filtered.convoIds.length;
  
  return filtered;
}

async function populateActorDropdown() {
  allActors = DB.getDistinctActors();
  filteredActors = [...allActors];
  
  // Toggle dropdown
  if (actorFilterBtn) {
    actorFilterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = actorFilterDropdown.style.display !== "none";
      actorFilterDropdown.style.display = isVisible ? "none" : "block";
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!actorFilterDropdown.contains(e.target) && e.target !== actorFilterBtn) {
      actorFilterDropdown.style.display = "none";
    }
  });
  
  // Prevent dropdown from closing when clicking inside
  actorFilterDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  
  // Search filter
  if (actorSearchInput) {
    actorSearchInput.addEventListener("input", () => {
      filterActors();
    });
  }
  
  // Select All checkbox
  if (selectAllActors) {
    selectAllActors.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const checkboxes = actorCheckboxList.querySelectorAll('input[type="checkbox"]');
      
      checkboxes.forEach(cb => {
        const actorId = parseInt(cb.dataset.actorId);
        cb.checked = isChecked;
        
        if (isChecked) {
          selectedActorIds.add(actorId);
        } else {
          selectedActorIds.delete(actorId);
        }
      });
      
      updateActorFilterLabel();
      triggerSearch();
    });
  }
  
  // Add to Selection button
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener("click", () => {
      const checkboxes = actorCheckboxList.querySelectorAll('input[type="checkbox"]:checked');
      checkboxes.forEach(cb => {
        selectedActorIds.add(parseInt(cb.dataset.actorId));
      });
      
      // Clear search and show all with current selection
      actorSearchInput.value = "";
      filterActors();
      updateActorFilterLabel();
      triggerSearch();
    });
  }
  
  renderActorCheckboxes(allActors);
}

function filterActors() {
  const searchText = actorSearchInput ? actorSearchInput.value.toLowerCase().trim() : "";
  
  if (!searchText) {
    filteredActors = [...allActors];
  } else {
    filteredActors = allActors.filter(actor => {
      return actor.name.toLowerCase().includes(searchText) || 
             actor.id.toString().includes(searchText);
    });
  }
  
  renderActorCheckboxes(filteredActors);
  updateSelectAllState();
}

function renderActorCheckboxes(actors) {
  actorCheckboxList.innerHTML = "";
  
  actors.forEach(actor => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.actorId = actor.id;
    checkbox.checked = selectedActorIds.has(actor.id);
    
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedActorIds.add(actor.id);
      } else {
        selectedActorIds.delete(actor.id);
      }
      updateSelectAllState();
      updateActorFilterLabel();
      triggerSearch();
    });
    
    const span = document.createElement("span");
    span.textContent = actor.name;
    
    label.appendChild(checkbox);
    label.appendChild(span);
    actorCheckboxList.appendChild(label);
  });
  
  updateSelectAllState();
}

function updateSelectAllState() {
  if (!selectAllActors) return;
  
  const visibleCheckboxes = actorCheckboxList.querySelectorAll('input[type="checkbox"]');
  const visibleActorIds = Array.from(visibleCheckboxes).map(cb => parseInt(cb.dataset.actorId));
  
  const allSelected = visibleActorIds.length > 0 && visibleActorIds.every(id => selectedActorIds.has(id));
  const someSelected = visibleActorIds.some(id => selectedActorIds.has(id));
  
  selectAllActors.checked = allSelected;
  selectAllActors.indeterminate = !allSelected && someSelected;
}

function updateActorFilterLabel() {
  if (!actorFilterLabel) return;
  
  if (selectedActorIds.size === 0 || selectedActorIds.size === allActors.length) {
    actorFilterLabel.textContent = "All Actors";
  } else if (selectedActorIds.size === 1) {
    const actorId = Array.from(selectedActorIds)[0];
    const actor = allActors.find(a => a.id === actorId);
    actorFilterLabel.textContent = actor ? actor.name : "1 Actor";
  } else {
    actorFilterLabel.textContent = `${selectedActorIds.size} Actors`;
  }
}

function triggerSearch() {
  if (searchInput.value) {
    searchDialogues(searchInput.value, minSearchLength, searchResultLimit);
  }
}

// Expand and highlight conversation in the conversation tree
function highlightConversationInTree(convoId) {
  // Remove highlight from all labels (both leaf and node labels)
  const allLabels = convoListEl.querySelectorAll(".label.selected");
  allLabels.forEach((label) => {
    label.classList.remove("selected");
  });

  // Find the leaf with data-convo-id
  let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoId}"]`);

  if (leafLabel) {
    // Highlight the leaf label itself and walk up the tree and expand all ancestor nodes
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
  convoId = UI.getParsedIntOrDefault(convoId);
  
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
  
  // Make sure current entry container is visible
  if (currentEntryContainerEl) {
    currentEntryContainerEl.style.visibility = "visible";
  }
  
  // Show "(no details)" in More Details section for conversation overview
  if (entryDetailsEl) {
    entryDetailsEl.innerHTML = "<div class='hint-text'>(no details)</div>";
  }
  
  // Check conversation type - orbs and tasks don't have meaningful entries
  const convoType = conversation?.type || 'flow';
  
  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";
  
  if (convoType === 'orb' || convoType === 'task') {
    // Orbs and tasks don't have dialogue options
    const message = document.createElement("div");
    message.className = "hint-text";
    message.style.fontStyle = "italic";
    message.style.padding = "12px";
    message.innerHTML = `This is ${convoType === 'orb' ? 'an' : 'a'} <strong>${convoType.toUpperCase()}</strong> and does not have dialogue options.`;
    entryListEl.appendChild(message);
    return;
  }
  
  const rows = DB.getEntriesForConversation(convoId);
  const filtered = rows.filter(
    (r) => (r.title || "").toLowerCase() !== "start"
  );
  if (!filtered.length) {
    entryListEl.textContent = "(no meaningful entries)";
    return;
  }
  filtered.forEach((r) => {
    const entryId = UI.getParsedIntOrDefault(r.id);
    const title = UI.getStringOrDefault(r.title, "(no title)");

    const text = r.dialoguetext || "";
    const el = UI.createCardItem(title, convoId, entryId, text);
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
    const cid = UI.getParsedIntOrDefault(previous.convoId);
    
    // If entryId is null, we're going back to the conversation root
    if (previous.entryId === null) {
      loadEntriesForConversation(cid, false);
      highlightConversationInTree(cid);
      updateBackButtonState();
      return;
    }
    
    // Update current state
    currentConvoId = cid;
    currentEntryId = UI.getParsedIntOrDefault(previous.entryId);
    
    // Update the UI to show this entry
    const coreRow = DB.getEntry(currentConvoId, currentEntryId);
    const title = coreRow ? coreRow.title : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    // Get conversation type
    const conversation = DB.getConversationById(currentConvoId);
    const convoType = conversation?.type || 'flow';
    
    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);
    
    // Load child options
    loadChildOptions(currentConvoId, currentEntryId);
    
    // Show details if expanded
    if (moreDetailsEl && moreDetailsEl.open) {
      await showEntryDetails(currentConvoId, currentEntryId);
    }
  }
  
  updateBackButtonState();
}

async function updateUiToShowEntry() {
    // Update the UI
    const coreRow = DB.getEntry(currentConvoId, currentEntryId); // About 650 entries without titles
    const title = coreRow ? coreRow.title : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    // Get conversation type
    const conversation = DB.getConversationById(currentConvoId);
    const convoType = conversation?.type || 'flow';
    
    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);
    
    // Load child options
    loadChildOptions(currentConvoId, currentEntryId);
    
    // Show details if expanded
    if (moreDetailsEl && moreDetailsEl.open) {
      await showEntryDetails(currentConvoId, currentEntryId);
    }
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
    const cid = UI.getParsedIntOrDefault(target.convoId);
    const eid = UI.getParsedIntOrDefault(target.entryId);
    
    // Update current state
    currentConvoId = cid;
    currentEntryId = eid;
    
    // Update the UI
    const coreRow = DB.getEntry(currentConvoId, currentEntryId);
    const title = coreRow ? coreRow.title : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    
    // Get conversation type
    const conversation = DB.getConversationById(currentConvoId);
    const convoType = conversation?.type || 'flow';
    
    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);
    
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
  convoId = UI.getParsedIntOrDefault(convoId);
  entryId = UI.getParsedIntOrDefault(entryId);

  // Check if we're already at this entry - if so, do nothing
  // BUT allow if we're not adding to history (going back)
  // BUG: When searching, I cannot click on a result if it is the current entry
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
  const title = coreRow ? coreRow.title : `(line ${convoId}:${entryId})`;
  const dialoguetext = coreRow ? coreRow.dialoguetext : "";
  
  // Get conversation type
  const conversation = DB.getConversationById(convoId);
  const convoType = conversation?.type || 'flow';
  
  UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);

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
    // Get selected actor IDs (null means all actors)
    const actorIds = selectedActorIds.size === 0 || selectedActorIds.size === allActors.length 
      ? null 
      : Array.from(selectedActorIds);

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
      actorIds
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
      const highlightedTitle = UI.highlightTerms(r.title || "", trimmedQ);
      const highlightedText = UI.highlightTerms(r.dialoguetext || "", trimmedQ);
      const div = UI.createCardItem(highlightedTitle, UI.getParsedIntOrDefault(r.conversationid), r.id, highlightedText, true);

      div.addEventListener("click", () => {
        const cid = UI.getParsedIntOrDefault(r.conversationid);
        const eid = UI.getParsedIntOrDefault(r.id);
        
        // Check if this is an orb or task (conversationid === id means it's from dialogues table)
        if (cid === eid) {
          // This is an orb or task, just load the conversation root
          loadEntriesForConversation(cid, true);
          highlightConversationInTree(cid);
        } else {
          // This is a regular flow entry
          navigationHistory = [{ convoId: cid, entryId: null }];
          navigateToEntry(cid, eid);
          highlightConversationInTree(cid);
        }
        
        document.querySelector(".selected")?.scrollIntoView(true);
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

      const el = UI.createCardItem(dest.title, c.d_convo, c.d_id, dest.dialoguetext);
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
