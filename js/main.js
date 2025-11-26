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
const typeFilterBtn = UI.$("typeFilterBtn");
const typeFilterLabel = UI.$("typeFilterLabel");
const typeFilterDropdown = UI.$("typeFilterDropdown");
const typeCheckboxList = UI.$("typeCheckboxList");
const selectAllTypes = UI.$("selectAllTypes");
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

// Mobile search elements
const mobileSearchTrigger = UI.$("mobileSearchTrigger");
const mobileSearchScreen = UI.$("mobileSearchScreen");
const mobileSearchInput = UI.$("mobileSearchInput");
const mobileSearchBtn = UI.$("mobileSearchBtn");
const mobileSearchBack = UI.$("mobileSearchBack");
const mobileSearchResults = UI.$("mobileSearchResults");
const mobileSearchLoader = UI.$("mobileSearchLoader");
const mobileConvoFilter = UI.$("mobileConvoFilter");
const mobileTypeFilter = UI.$("mobileTypeFilter");
const mobileActorFilter = UI.$("mobileActorFilter");
const mobileConvoFilterValue = UI.$("mobileConvoFilterValue");
const mobileTypeFilterValue = UI.$("mobileTypeFilterValue");
const mobileActorFilterValue = UI.$("mobileActorFilterValue");
const mobileConvoFilterScreen = UI.$("mobileConvoFilterScreen");
const mobileActorFilterScreen = UI.$("mobileActorFilterScreen");
const mobileTypeFilterSheet = UI.$("mobileTypeFilterSheet");

// Mobile sidebar elements
const mobileSidebarToggle = UI.$("mobileSidebarToggle");
const mobileSidebarOverlay = UI.$("mobileSidebarOverlay");
const conversationsSection = UI.$("conversations-section");
const mobileHeader = UI.$("mobileHeader");
const mobileHeaderTitle = UI.$("mobileHeaderTitle");
const mobileBackBtn = UI.$("mobileBackBtn");
const mobileRootBtn = UI.$("mobileRootBtn");

const minSearchLength = 3;
const searchResultLimit = 50;

let navigationHistory = [];
let currentConvoId = null;
let currentEntryId = null;
let currentAlternateCondition = null;
let currentAlternateLine = null;
let conversationTree = null;
let activeTypeFilter = "all";
let allActors = [];
let selectedActorIds = new Set();
let selectedTypeIds = new Set(["flow", "orb", "task"]); // All types selected by default
let filteredActors = [];

// Search pagination state
let currentSearchQuery = "";
let currentSearchActorIds = null;
let currentSearchOffset = 0;
let currentSearchTotal = 0;
let currentSearchFilteredCount = 0; // Count after type filtering
let isLoadingMore = false;

// Mobile search state
let mobileSelectedConvoId = null;
let mobileSelectedConvoIds = new Set();
let mobileSelectedTypes = new Set(["all"]);
let mobileSelectedActorIds = new Set();

// Mobile search pagination state
let mobileSearchQuery = "";
let mobileSearchActorIds = null;
let mobileSearchOffset = 0;
let mobileSearchTotal = 0;
let mobileSearchFilteredCount = 0;
let isMobileLoadingMore = false;

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
  
  // type filter dropdown
  setupTypeFilter();

  // wire search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () =>
      searchDialogues(searchInput.value)
    );
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter")
        searchDialogues(searchInput.value);
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
        await showEntryDetails(currentConvoId, currentEntryId, currentAlternateCondition, currentAlternateLine);
        // Make dialogue options compact when More Details is expanded
        const entryListContainer = entryListEl?.closest('.entry-list');
        if (entryListContainer && !entryListContainer.classList.contains('compact')) {
          entryListContainer.setAttribute('data-was-expanded', 'true');
          entryListContainer.classList.add('compact');
        }
        if (currentEntryContainerEl && !currentEntryContainerEl.classList.contains('expanded')) {
          currentEntryContainerEl.setAttribute('data-was-expanded', 'true');
          currentEntryContainerEl.classList.add('expanded');
        }
      } else {
        // Restore original state when More Details is collapsed
        const entryListContainer = entryListEl?.closest('.entry-list');
        if (entryListContainer && entryListContainer.getAttribute('data-was-expanded') === 'true') {
          entryListContainer.classList.remove('compact');
          entryListContainer.removeAttribute('data-was-expanded');
        }
        if (currentEntryContainerEl && currentEntryContainerEl.getAttribute('data-was-expanded') === 'true') {
          currentEntryContainerEl.classList.remove('expanded');
          currentEntryContainerEl.removeAttribute('data-was-expanded');
        }
      }
    });
  }
  
  // Setup infinite scroll for search
  setupSearchInfiniteScroll();
  setupMobileSearchInfiniteScroll();
  
  // Setup conversation help tooltip
  setupConversationHelpTooltip();
  
  // Setup mobile sidebar
  setupMobileSidebar();
  
  // Setup mobile search
  setupMobileSearch();
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

// Setup type filter
function setupTypeFilter() {
  if (!typeFilterBtn || !typeFilterDropdown) return;
  
  // Toggle dropdown
  typeFilterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = typeFilterDropdown.style.display !== "none";
    typeFilterDropdown.style.display = isVisible ? "none" : "block";
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!typeFilterDropdown.contains(e.target) && e.target !== typeFilterBtn) {
      typeFilterDropdown.style.display = "none";
    }
  });
  
  // Prevent dropdown from closing when clicking inside
  typeFilterDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  
  // Select All checkbox
  if (selectAllTypes) {
    selectAllTypes.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const checkboxes = typeCheckboxList.querySelectorAll('input[type="checkbox"][data-type]');
      
      checkboxes.forEach(cb => {
        const type = cb.dataset.type;
        cb.checked = isChecked;
        
        if (isChecked) {
          selectedTypeIds.add(type);
        } else {
          selectedTypeIds.delete(type);
        }
      });
      
      updateTypeFilterLabel();
      triggerSearch();
    });
  }
  
  // Individual type checkboxes
  const typeCheckboxes = typeCheckboxList.querySelectorAll('input[type="checkbox"][data-type]');
  typeCheckboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      const type = cb.dataset.type;
      
      if (cb.checked) {
        selectedTypeIds.add(type);
      } else {
        selectedTypeIds.delete(type);
      }
      
      updateTypeSelectAllState();
      updateTypeFilterLabel();
      triggerSearch();
    });
  });
  
  updateTypeFilterLabel();
}

function updateTypeSelectAllState() {
  if (!selectAllTypes) return;
  
  const typeCheckboxes = typeCheckboxList.querySelectorAll('input[type="checkbox"][data-type]');
  const allTypes = Array.from(typeCheckboxes).map(cb => cb.dataset.type);
  
  const allSelected = allTypes.length > 0 && allTypes.every(type => selectedTypeIds.has(type));
  const someSelected = allTypes.some(type => selectedTypeIds.has(type));
  
  selectAllTypes.checked = allSelected;
  selectAllTypes.indeterminate = !allSelected && someSelected;
}

function updateTypeFilterLabel() {
  if (!typeFilterLabel) return;
  
  if (selectedTypeIds.size === 0 || selectedTypeIds.size === 3) {
    typeFilterLabel.textContent = "All Types";
  } else if (selectedTypeIds.size === 1) {
    const type = Array.from(selectedTypeIds)[0];
    typeFilterLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  } else {
    typeFilterLabel.textContent = `${selectedTypeIds.size} Types`;
  }
}

// Setup conversation help tooltip
function setupConversationHelpTooltip() {
  const helpIcon = document.getElementById('conversationHelp');
  const tooltip = document.getElementById('conversationHelpTooltip');
  
  if (!helpIcon || !tooltip) {
    console.warn('Tooltip elements not found:', { helpIcon, tooltip });
    return;
  }
  
  let isTooltipOpen = false;
  
  // Toggle on click
  helpIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    isTooltipOpen = !isTooltipOpen;
    if (isTooltipOpen) {
      tooltip.classList.add('show');
      helpIcon.classList.add('active');
    } else {
      tooltip.classList.remove('show');
      helpIcon.classList.remove('active');
    }
  });
  
  // Show on hover
  helpIcon.addEventListener('mouseenter', () => {
    if (!isTooltipOpen) {
      tooltip.classList.add('show');
    }
  });
  
  helpIcon.addEventListener('mouseleave', () => {
    if (!isTooltipOpen) {
      tooltip.classList.remove('show');
    }
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!helpIcon.contains(e.target) && !tooltip.contains(e.target)) {
      isTooltipOpen = false;
      tooltip.classList.remove('show');
      helpIcon.classList.remove('active');
    }
  });
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
  
  // Close mobile sidebar when conversation is selected
  closeMobileSidebar();
  
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
  
  // Remove search mode styling
  const entryListContainer = entryListEl?.closest('.entry-list');
  if (entryListContainer) entryListContainer.classList.remove('full-height');
  
  // Update current state for conversation root
  currentConvoId = convoId;
  currentEntryId = null;
  
  // Hide root button at conversation root
  if (rootBtn) {
    rootBtn.style.display = "none";
  }
  
  // Update mobile nav buttons (at root, so hide both)
  updateMobileNavButtons();
  
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
  
  // Hide More Details for conversation overviews (no dentries)
  if (moreDetailsEl) {
    moreDetailsEl.style.display = "none";
  }
  
  // Check conversation type - orbs and tasks don't have meaningful entries
  const convoType = conversation?.type || 'flow';
  
  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";
  
  if (convoType === 'orb' || convoType === 'task') {
    // Orbs and tasks don't have dialogue options - make the section compact
    entryListEl.classList.add('compact');
    // Expand the current entry container to use more space
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add('expanded');
    }
    const message = document.createElement("div");
    message.className = "hint-text";
    message.style.fontStyle = "italic";
    message.style.padding = "12px";
    message.innerHTML = `This is ${convoType === 'orb' ? 'an' : 'a'} <strong>${convoType.toUpperCase()}</strong> and does not have dialogue options.`;
    entryListEl.appendChild(message);
    return;
  }
  
  // For flows, remove compact class and expanded class
  entryListEl.classList.remove('compact');
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove('expanded');
  }
  
  const rows = DB.getEntriesForConversation(convoId);
  const filtered = rows.filter(
    (r) => (r.title || "").toLowerCase() !== "start"
  );
  if (!filtered.length) {
    // No entries - make compact like orbs/tasks
    entryListEl.classList.add('compact');
    const entryList = entryListEl.closest('.entry-list');
    if (entryList) entryList.classList.add('compact');
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add('expanded');
    }
    const message = document.createElement("div");
    message.className = "hint-text";
    message.style.fontStyle = "italic";
    message.style.padding = "12px";
    message.textContent = "(no meaningful entries)";
    entryListEl.appendChild(message);
    return;
  }
  
  // Has entries - remove compact classes
  entryListEl.classList.remove('compact');
  const entryList = entryListEl.closest('.entry-list');
  if (entryList) entryList.classList.remove('compact');
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove('expanded');
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
async function navigateToEntry(convoId, entryId, addToHistory = true, selectedAlternateCondition = null, selectedAlternateLine = null) {
  // Ensure numeric Ids
  convoId = UI.getParsedIntOrDefault(convoId);
  entryId = UI.getParsedIntOrDefault(entryId);

  // Check if we're at the same entry AND same alternate view
  const sameEntry = currentConvoId === convoId && currentEntryId === entryId;
  const sameAlternate = currentAlternateCondition === selectedAlternateCondition && 
                        currentAlternateLine === selectedAlternateLine;
  
  // If at same entry AND same alternate, only block if trying to add to history
  // This prevents duplicate history entries when clicking the same thing twice
  if (sameEntry && sameAlternate && addToHistory) {
    return;
  }
  
  // If we're at the same entry (regardless of alternate), don't add to history
  // This allows switching between alternates without cluttering history
  if (sameEntry) {
    addToHistory = false;
  }

  // Make visible
  if (currentEntryContainerEl) {
    currentEntryContainerEl.style.visibility = "visible";
    currentEntryContainerEl.style.display = "block";
  }
  
  // Also restore entry list layout when navigating from search
  const entryListContainer = entryListEl?.closest('.entry-list');
  if (entryListContainer) {
    entryListContainer.classList.remove('full-height');
  }

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
  // Use alternate line if provided, otherwise use the original dialogue text
  const dialoguetext = selectedAlternateLine || (coreRow ? coreRow.dialoguetext : "");
  
  // Get conversation type
  const conversation = DB.getConversationById(convoId);
  const convoType = conversation?.type || 'flow';
  
  UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);

  currentConvoId = convoId;
  currentEntryId = entryId;
  currentAlternateCondition = selectedAlternateCondition;
  currentAlternateLine = selectedAlternateLine;
  
  // Show More Details for actual entries (they have dentries)
  if (moreDetailsEl) {
    moreDetailsEl.style.display = "block";
  }
  
  // Show/hide root button
  if (rootBtn) {
    rootBtn.style.display = currentEntryId !== null ? "inline-block" : "none";
  }
  
  // Update mobile nav buttons
  updateMobileNavButtons();

  // Load child options
  loadChildOptions(convoId, entryId);

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    // Clear cache to force reload when switching between alternate views
    if (sameEntry) {
      DB.clearCacheForEntry(convoId, entryId);
    }
    await showEntryDetails(convoId, entryId, selectedAlternateCondition, selectedAlternateLine);
  }
}

/* Show entry details (optimized) */
async function showEntryDetails(convoId, entryId, selectedAlternateCondition = null, selectedAlternateLine = null) {
  if (!DB || !entryDetailsEl) return;

  // Check cache only if viewing the original (no alternate selected)
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const cached = DB.getCachedEntry(convoId, entryId);
    if (cached) {
      UI.renderEntryDetails(entryDetailsEl, {
        ...cached,
        selectedAlternateCondition: null,
        selectedAlternateLine: null,
        originalDialogueText: cached.originalDialogueText || entry?.dialoguetext,
        onNavigate: navigateToEntry,
      });
      return;
    }
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
    selectedAlternateCondition: selectedAlternateCondition,
    selectedAlternateLine: selectedAlternateLine,
    originalDialogueText: entry.dialoguetext,
    onNavigate: navigateToEntry,
  };

  // Only cache the base data without alternate-specific info
  // This prevents stale alternate data from being served from cache
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const basePayload = { ...payload };
    delete basePayload.selectedAlternateCondition;
    delete basePayload.selectedAlternateLine;
    DB.cacheEntry(convoId, entryId, basePayload);
  }

  UI.renderEntryDetails(entryDetailsEl, payload);
}

/* Search */
function searchDialogues(q, resetSearch = true) {
  const trimmedQ = q.trim();
  
  if (resetSearch) {
    // Starting a new search
    currentSearchQuery = trimmedQ;
    currentSearchActorIds = selectedActorIds.size === 0 || selectedActorIds.size === allActors.length 
      ? null 
      : Array.from(selectedActorIds);
    currentSearchOffset = 0;
    
    if (searchLoader) searchLoader.style.display = "flex";
    
    // Hide current entry and make search take full space
    if (currentEntryContainerEl)
      currentEntryContainerEl.style.display = "none";
    const entryListContainer = entryListEl.closest('.entry-list');
    if (entryListContainer) {
      entryListContainer.classList.add('full-height');
      entryListContainer.classList.remove('compact');
    }
    if (entryListEl) {
      entryListEl.classList.remove('compact');
    }
    
    entryListEl.innerHTML = "";
  }
  
  if (isLoadingMore) return;
  isLoadingMore = true;
  
  try {
    const response = DB.searchDialogues(
      currentSearchQuery,
      3, // minLength (no longer used but kept for compatibility)
      searchResultLimit,
      currentSearchActorIds,
      true, // filterStartInput
      currentSearchOffset
    );
    
    const { results: res, total } = response;
    currentSearchTotal = total;
    
    // Filter by conversation type if not all types selected
    let filteredResults = res;
    if (selectedTypeIds.size > 0 && selectedTypeIds.size < 3) {
      filteredResults = res.filter(r => {
        const convo = DB.getConversationById(r.conversationid);
        const type = convo ? (convo.type || 'flow') : 'flow';
        return selectedTypeIds.has(type);
      });
    }
    
    if (resetSearch) {
      entryListHeaderEl.textContent = "Search Results";
      entryListEl.innerHTML = "";
      currentSearchFilteredCount = 0;
      
      if (!filteredResults.length) {
        entryListEl.textContent = "(no matches)";
        entryListHeaderEl.textContent += ` (0)`;
        return;
      }
    }
    
    // Update filtered count
    currentSearchFilteredCount += filteredResults.length;
    
    // Update header with current count
    if (selectedTypeIds.size > 0 && selectedTypeIds.size < 3) {
      // Show filtered count when type filter is active
      entryListHeaderEl.textContent = `Search Results (${currentSearchFilteredCount} filtered)`;
    } else {
      // Show total count when all types selected
      entryListHeaderEl.textContent = `Search Results (${currentSearchFilteredCount} of ${total})`;
    }
    
    // Add results to list
    filteredResults.forEach((r) => {
      const highlightedTitle = UI.highlightTerms(r.title || "", currentSearchQuery);
      const highlightedText = UI.highlightTerms(r.dialoguetext || "", currentSearchQuery);
      
      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid);
      const convoType = convo ? (convo.type || 'flow') : 'flow';
      
      const div = UI.createCardItem(highlightedTitle, UI.getParsedIntOrDefault(r.conversationid), r.id, highlightedText, true, convoType);

      div.addEventListener("click", () => {
        const cid = UI.getParsedIntOrDefault(r.conversationid);
        const eid = UI.getParsedIntOrDefault(r.id);
        
        // Check if this is an orb or task (conversationid === id means it's from dialogues table)
        if (cid === eid) {
          // This is an orb or task, just load the conversation root
          loadEntriesForConversation(cid, true);
          highlightConversationInTree(cid);
        } else {
          // This is a regular flow entry or alternate
          navigationHistory = [{ convoId: cid, entryId: null }];
          // If this is an alternate, pass the condition and alternate line
          const alternateCondition = r.isAlternate ? r.alternatecondition : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
          highlightConversationInTree(cid);
        }
        
        document.querySelector(".selected")?.scrollIntoView(true);
      });
      entryListEl.appendChild(div);
    });
    
    // Update offset for next load (based on database results, not filtered)
    currentSearchOffset += res.length;
    
    // Remove any existing loading indicator
    const oldLoadingIndicator = entryListEl.querySelector('.search-loading-indicator');
    if (oldLoadingIndicator) {
      oldLoadingIndicator.remove();
    }
    
    // Add loading indicator if there are more results in the database and we got results this time
    if (res.length > 0 && currentSearchOffset < currentSearchTotal) {
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "search-loading-indicator";
      loadingIndicator.textContent = "Loading more...";
      loadingIndicator.style.padding = "12px";
      loadingIndicator.style.textAlign = "center";
      loadingIndicator.style.fontStyle = "italic";
      loadingIndicator.style.color = "#666";
      entryListEl.appendChild(loadingIndicator);
    }
    
  } catch (e) {
    console.error("Search error", e);
    if (resetSearch) {
      entryListEl.textContent = "Search error";
    }
  } finally {
    isLoadingMore = false;
    if (searchLoader) searchLoader.style.display = "none";
  }
}

// Setup infinite scroll for search results
function setupSearchInfiniteScroll() {
  if (!entryListEl) return;
  
  entryListEl.addEventListener('scroll', () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = entryListEl.scrollTop;
    const scrollHeight = entryListEl.scrollHeight;
    const clientHeight = entryListEl.clientHeight;
    
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (scrolledToBottom && !isLoadingMore && currentSearchOffset < currentSearchTotal) {
      // Remove loading indicator
      const loadingIndicator = entryListEl.querySelector('.search-loading-indicator');
      if (loadingIndicator) loadingIndicator.remove();
      
      // Load more results
      searchDialogues(currentSearchQuery, false);
    }
  });
}

// Setup infinite scroll for mobile search results
function setupMobileSearchInfiniteScroll() {
  if (!mobileSearchScreen) return;
  
  mobileSearchScreen.addEventListener('scroll', () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = mobileSearchScreen.scrollTop;
    const scrollHeight = mobileSearchScreen.scrollHeight;
    const clientHeight = mobileSearchScreen.clientHeight;
    
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (scrolledToBottom && !isMobileLoadingMore && mobileSearchOffset < mobileSearchTotal) {
      // Remove loading indicator
      const loadingIndicator = mobileSearchResults.querySelector('.mobile-search-loading-indicator');
      if (loadingIndicator) loadingIndicator.remove();
      
      // Load more results
      performMobileSearch(false);
    }
  });
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

    if (entryListEl.children.length === 0) {
      // No further options - make compact like orbs/tasks
      entryListEl.classList.add('compact');
      const entryList = entryListEl.closest('.entry-list');
      if (entryList) entryList.classList.add('compact');
      if (currentEntryContainerEl) {
        currentEntryContainerEl.classList.add('expanded');
      }
      const message = document.createElement("div");
      message.className = "hint-text";
      message.style.fontStyle = "italic";
      message.style.padding = "12px";
      message.textContent = "(no further options)";
      entryListEl.appendChild(message);
    }
  } catch (e) {
    console.error("Error loading child links", e);
    entryListEl.textContent = "(error loading next options)";
  }
}

/* Mobile Search Functions */
function setupMobileSearch() {
  // Open mobile search screen
  if (mobileSearchTrigger) {
    mobileSearchTrigger.addEventListener("click", () => {
      mobileSearchScreen.style.display = "block";
      mobileSearchInput.focus();
    });
  }
  
  // Close mobile search screen
  if (mobileSearchBack) {
    mobileSearchBack.addEventListener("click", () => {
      mobileSearchScreen.style.display = "none";
    });
  }
  
  // Mobile search - Enter key triggers search
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performMobileSearch();
    });
  }
  
  // Conversation filter
  if (mobileConvoFilter) {
    mobileConvoFilter.addEventListener("click", () => {
      showMobileConvoFilter();
    });
  }
  
  // Type filter
  if (mobileTypeFilter) {
    mobileTypeFilter.addEventListener("click", () => {
      showMobileTypeFilter();
    });
  }
  
  // Actor filter
  if (mobileActorFilter) {
    mobileActorFilter.addEventListener("click", () => {
      showMobileActorFilter();
    });
  }
  
  // Setup conversation filter screen
  setupMobileConvoFilter();
  
  // Setup actor filter screen
  setupMobileActorFilter();
  
  // Setup type filter sheet
  setupMobileTypeFilter();
}

function setupMobileSidebar() {
  // Open sidebar
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Toggle clicked", conversationsSection);
      if (conversationsSection) {
        conversationsSection.classList.add("open");
        console.log("Added open class");
      }
      if (mobileSidebarOverlay) {
        mobileSidebarOverlay.style.display = "block";
        console.log("Showing overlay");
      }
    });
  } else {
    console.log("mobileSidebarToggle not found");
  }
  
  // Close sidebar when clicking overlay
  if (mobileSidebarOverlay) {
    mobileSidebarOverlay.addEventListener("click", () => {
      closeMobileSidebar();
    });
  }
  
  // Mobile back button
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener("click", () => {
      goBack();
      updateMobileNavButtons();
    });
  }
  
  // Mobile root button
  if (mobileRootBtn) {
    mobileRootBtn.addEventListener("click", () => {
      if (currentConvoId !== null) {
        loadEntriesForConversation(currentConvoId, false);
        updateMobileNavButtons();
      }
    });
  }
}

function updateMobileNavButtons() {
  if (!mobileBackBtn || !mobileRootBtn) return;
  
  // Show back button if we have navigation history
  if (navigationHistory.length > 1) {
    mobileBackBtn.style.display = "flex";
  } else {
    mobileBackBtn.style.display = "none";
  }
  
  // Show root button if we're not at conversation root
  if (currentEntryId !== null) {
    mobileRootBtn.style.display = "flex";
  } else {
    mobileRootBtn.style.display = "none";
  }
}

function closeMobileSidebar() {
  if (conversationsSection) {
    conversationsSection.classList.remove("open");
  }
  if (mobileSidebarOverlay) {
    mobileSidebarOverlay.style.display = "none";
  }
}

function performMobileSearch(resetSearch = true) {
  const query = mobileSearchInput.value.trim();
  
  if (resetSearch) {
    // Starting a new search
    mobileSearchQuery = query;
    mobileSearchActorIds = mobileSelectedActorIds.size === 0 || mobileSelectedActorIds.size === allActors.length
      ? null
      : Array.from(mobileSelectedActorIds);
    mobileSearchOffset = 0;
    
    mobileSearchLoader.style.display = "flex";
    mobileSearchResults.innerHTML = "";
  }
  
  if (isMobileLoadingMore) return;
  isMobileLoadingMore = true;
  
  try {
    const response = DB.searchDialogues(
      mobileSearchQuery,
      3,
      searchResultLimit,
      mobileSearchActorIds,
      true,
      mobileSearchOffset
    );
    const { results, total } = response;
    mobileSearchTotal = total;
    
    // Filter by conversations if selected
    let filteredResults = results;
    if (mobileSelectedConvoIds.size > 0) {
      filteredResults = results.filter(r => mobileSelectedConvoIds.has(r.conversationid));
    }
    
    // Filter by type if not "all"
    if (!mobileSelectedTypes.has("all")) {
      filteredResults = filteredResults.filter(r => {
        const convo = DB.getConversationById(r.conversationid);
        return convo && mobileSelectedTypes.has(convo.type || 'flow');
      });
    }
    
    mobileSearchLoader.style.display = "none";
    
    if (resetSearch) {
      mobileSearchFilteredCount = 0;
    }
    
    if (resetSearch && filteredResults.length === 0) {
      mobileSearchResults.innerHTML = '<div class="mobile-search-prompt">No results found</div>';
      return;
    }
    
    filteredResults.forEach(r => {
      const highlightedTitle = UI.highlightTerms(r.title || "", mobileSearchQuery);
      const highlightedText = UI.highlightTerms(r.dialoguetext || "", mobileSearchQuery);
      
      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid);
      const convoType = convo ? (convo.type || 'flow') : 'flow';
      
      const div = UI.createCardItem(highlightedTitle, UI.getParsedIntOrDefault(r.conversationid), r.id, highlightedText, true, convoType);
      
      div.addEventListener("click", () => {
        // Check if this is an orb/task (cid === eid means conversation root for orbs/tasks)
        const cid = UI.getParsedIntOrDefault(r.conversationid);
        const eid = r.id;
        
        if (cid === eid) {
          // This is an orb or task - load the conversation root
          loadEntriesForConversation(cid, true);
        } else {
          // This is a regular dialogue entry or alternate
          // If this is an alternate, pass the condition and alternate line
          const alternateCondition = r.isAlternate ? r.alternatecondition : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
        }
        
        // Close mobile search and return to main view
        mobileSearchScreen.style.display = "none";
      });
      
      mobileSearchResults.appendChild(div);
    });
    
    // Update offset for next load (based on database results, not filtered)
    mobileSearchOffset += results.length;
    
    // Remove any existing loading indicator
    const oldLoadingIndicator = mobileSearchResults.querySelector('.mobile-search-loading-indicator');
    if (oldLoadingIndicator) {
      oldLoadingIndicator.remove();
    }
    
    // Add loading indicator if there are more results in the database and we got results this time
    if (results.length > 0 && mobileSearchOffset < mobileSearchTotal) {
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "mobile-search-loading-indicator";
      loadingIndicator.textContent = "Loading more...";
      loadingIndicator.style.padding = "12px";
      loadingIndicator.style.textAlign = "center";
      loadingIndicator.style.fontStyle = "italic";
      loadingIndicator.style.color = "#666";
      mobileSearchResults.appendChild(loadingIndicator);
    }
    
  } catch (e) {
    console.error("Mobile search error:", e);
    mobileSearchLoader.style.display = "none";
    if (resetSearch) {
      mobileSearchResults.innerHTML = '<div class="mobile-search-prompt">Error performing search</div>';
    }
  } finally {
    isMobileLoadingMore = false;
    mobileSearchLoader.style.display = "none";
  }
}

function showMobileConvoFilter() {
  mobileConvoFilterScreen.style.display = "block";
}

function showMobileActorFilter() {
  mobileActorFilterScreen.style.display = "block";
}

function showMobileTypeFilter() {
  mobileTypeFilterSheet.style.display = "block";
  mobileTypeFilterSheet.classList.add("active");
}

function setupMobileConvoFilter() {
  const backBtn = UI.$("mobileConvoFilterBack");
  const searchInput = UI.$("mobileConvoFilterSearch");
  const listContainer = UI.$("mobileConvoFilterList");
  const selectAllCheckbox = UI.$("mobileConvoSelectAll");
  const addToSelectionBtn = UI.$("mobileConvoAddToSelection");
  
  if (!backBtn || !searchInput || !listContainer) return;
  
  let tempSelectedConvoIds = new Set(mobileSelectedConvoIds);
  let allConvos = [];
  let filteredConvos = [];
  
  // Back button - don't apply changes
  backBtn.addEventListener("click", () => {
    mobileConvoFilterScreen.style.display = "none";
    tempSelectedConvoIds = new Set(mobileSelectedConvoIds);
  });
  
  // Add to Selection button - apply changes
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener("click", () => {
      mobileSelectedConvoIds = new Set(tempSelectedConvoIds);
      updateMobileConvoFilterLabel();
      mobileConvoFilterScreen.style.display = "none";
      if (mobileSearchInput.value) performMobileSearch();
    });
  }
  
  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered convos
        filteredConvos.forEach(c => tempSelectedConvoIds.add(c.id));
      } else {
        // Deselect all filtered convos
        filteredConvos.forEach(c => tempSelectedConvoIds.delete(c.id));
      }
      renderConvoList(filteredConvos);
    });
  }
  
  // Render conversation list
  function renderConvoList(conversations) {
    listContainer.innerHTML = "";
    filteredConvos = conversations;
    
    // Update Select All checkbox state
    if (selectAllCheckbox) {
      const allSelected = conversations.length > 0 && conversations.every(c => tempSelectedConvoIds.has(c.id));
      const someSelected = conversations.some(c => tempSelectedConvoIds.has(c.id));
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
    
    // Add conversation items
    conversations.forEach(convo => {
      const item = document.createElement("div");
      item.className = "mobile-filter-item";
      const isChecked = tempSelectedConvoIds.has(convo.id);
      item.innerHTML = `
        <input type="checkbox" ${isChecked ? 'checked' : ''} />
        <span>${convo.title || `Conversation ${convo.id}`}</span>
      `;
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;
        }
        
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
          tempSelectedConvoIds.add(convo.id);
        } else {
          tempSelectedConvoIds.delete(convo.id);
        }
        
        // Update Select All checkbox
        if (selectAllCheckbox) {
          const allSelected = filteredConvos.every(c => tempSelectedConvoIds.has(c.id));
          const someSelected = filteredConvos.some(c => tempSelectedConvoIds.has(c.id));
          selectAllCheckbox.checked = allSelected;
          selectAllCheckbox.indeterminate = someSelected && !allSelected;
        }
      });
      listContainer.appendChild(item);
    });
  }
  
  // Initial render
  allConvos = DB.getAllConversations();
  renderConvoList(allConvos);
  
  // Search filter
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderConvoList(allConvos);
      return;
    }
    
    const filtered = allConvos.filter(c => {
      return (c.title || "").toLowerCase().includes(query) || 
             c.id.toString().includes(query);
    });
    renderConvoList(filtered);
  });
}

function updateMobileConvoFilterLabel() {
  if (mobileSelectedConvoIds.size === 0) {
    mobileConvoFilterValue.textContent = "All";
  } else if (mobileSelectedConvoIds.size === 1) {
    const convoId = Array.from(mobileSelectedConvoIds)[0];
    const allConvos = DB.getAllConversations();
    const convo = allConvos.find(c => c.id === convoId);
    mobileConvoFilterValue.textContent = convo ? (convo.title || `#${convo.id}`) : "1 Convo";
  } else {
    mobileConvoFilterValue.textContent = `${mobileSelectedConvoIds.size} Convos`;
  }
}

function setupMobileActorFilter() {
  const backBtn = UI.$("mobileActorFilterBack");
  const searchInput = UI.$("mobileActorFilterSearch");
  const listContainer = UI.$("mobileActorFilterList");
  const selectAllCheckbox = UI.$("mobileActorSelectAll");
  const addToSelectionBtn = UI.$("mobileActorAddToSelection");
  
  if (!backBtn || !searchInput || !listContainer) return;
  
  let tempSelectedActorIds = new Set(mobileSelectedActorIds);
  let filteredActors = [];
  
  // Back button - don't apply changes
  backBtn.addEventListener("click", () => {
    mobileActorFilterScreen.style.display = "none";
    tempSelectedActorIds = new Set(mobileSelectedActorIds);
  });
  
  // Add to Selection button - apply changes
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener("click", () => {
      mobileSelectedActorIds = new Set(tempSelectedActorIds);
      updateMobileActorFilterLabel();
      mobileActorFilterScreen.style.display = "none";
      if (mobileSearchInput.value) performMobileSearch();
    });
  }
  
  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered actors
        filteredActors.forEach(a => tempSelectedActorIds.add(a.id));
      } else {
        // Deselect all filtered actors
        filteredActors.forEach(a => tempSelectedActorIds.delete(a.id));
      }
      renderActorList(filteredActors);
    });
  }
  
  // Render actor list
  function renderActorList(actors) {
    listContainer.innerHTML = "";
    filteredActors = actors;
    
    // Update Select All checkbox state
    if (selectAllCheckbox) {
      const allSelected = actors.length > 0 && actors.every(a => tempSelectedActorIds.has(a.id));
      const someSelected = actors.some(a => tempSelectedActorIds.has(a.id));
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
    
    // Add actor items
    actors.forEach(actor => {
      const item = document.createElement("div");
      item.className = "mobile-filter-item";
      const isChecked = tempSelectedActorIds.has(actor.id);
      item.innerHTML = `
        <input type="checkbox" ${isChecked ? 'checked' : ''} />
        <span>${actor.name}</span>
      `;
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;
        }
        
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox.checked) {
          tempSelectedActorIds.add(actor.id);
        } else {
          tempSelectedActorIds.delete(actor.id);
        }
        
        // Update Select All checkbox
        if (selectAllCheckbox) {
          const allSelected = filteredActors.every(a => tempSelectedActorIds.has(a.id));
          const someSelected = filteredActors.some(a => tempSelectedActorIds.has(a.id));
          selectAllCheckbox.checked = allSelected;
          selectAllCheckbox.indeterminate = someSelected && !allSelected;
        }
      });
      listContainer.appendChild(item);
    });
  }
  
  // Initial render
  renderActorList(allActors);
  
  // Search filter
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderActorList(allActors);
      return;
    }
    
    const filtered = allActors.filter(a => {
      return a.name.toLowerCase().includes(query) || 
             a.id.toString().includes(query);
    });
    renderActorList(filtered);
  });
}

function updateMobileActorFilterLabel() {
  if (mobileSelectedActorIds.size === 0) {
    mobileActorFilterValue.textContent = "All";
  } else if (mobileSelectedActorIds.size === 1) {
    const actorId = Array.from(mobileSelectedActorIds)[0];
    const actor = allActors.find(a => a.id === actorId);
    mobileActorFilterValue.textContent = actor ? actor.name : "1 Actor";
  } else {
    mobileActorFilterValue.textContent = `${mobileSelectedActorIds.size} Actors`;
  }
}

function setupMobileTypeFilter() {
  const applyBtn = UI.$("mobileTypeApply");
  const checkboxes = mobileTypeFilterSheet.querySelectorAll('input[type="checkbox"]');
  
  if (!applyBtn) return;
  
  // Close sheet when clicking outside content
  mobileTypeFilterSheet.addEventListener("click", (e) => {
    if (e.target === mobileTypeFilterSheet) {
      mobileTypeFilterSheet.style.display = "none";
      mobileTypeFilterSheet.classList.remove("active");
    }
  });
  
  // Handle "All" checkbox behavior
  checkboxes.forEach(cb => {
    cb.addEventListener("change", () => {
      const type = cb.dataset.type;
      
      if (type === "all" && cb.checked) {
        // Check all others when "All" is checked
        checkboxes.forEach(otherCb => {
          otherCb.checked = true;
        });
      } else if (type === "all" && !cb.checked) {
        // Uncheck all others when "All" is unchecked
        checkboxes.forEach(otherCb => {
          otherCb.checked = false;
        });
      } else if (type !== "all") {
        // If a specific type is checked/unchecked, update "All" checkbox
        const allCheckbox = mobileTypeFilterSheet.querySelector('input[data-type="all"]');
        const specificCheckboxes = Array.from(checkboxes).filter(cb => cb.dataset.type !== "all");
        const allSpecificChecked = specificCheckboxes.every(cb => cb.checked);
        const anySpecificChecked = specificCheckboxes.some(cb => cb.checked);
        
        if (allCheckbox) {
          allCheckbox.checked = allSpecificChecked;
          allCheckbox.indeterminate = anySpecificChecked && !allSpecificChecked;
        }
      }
    });
  });
  
  // Apply button
  applyBtn.addEventListener("click", () => {
    mobileSelectedTypes.clear();
    
    checkboxes.forEach(cb => {
      if (cb.checked) {
        mobileSelectedTypes.add(cb.dataset.type);
      }
    });
    
    // Update label
    if (mobileSelectedTypes.has("all") || mobileSelectedTypes.size === 0) {
      mobileTypeFilterValue.textContent = "All";
    } else if (mobileSelectedTypes.size === 1) {
      const type = Array.from(mobileSelectedTypes)[0];
      mobileTypeFilterValue.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    } else {
      mobileTypeFilterValue.textContent = `${mobileSelectedTypes.size} Types`;
    }
    
    // Close sheet
    mobileTypeFilterSheet.style.display = "none";
    mobileTypeFilterSheet.classList.remove("active");
    
    // Perform search if there's a query
    if (mobileSearchInput.value) performMobileSearch();
  });
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
