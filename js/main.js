// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import * as DB from "./db.js";
import { buildTitleTree, renderTree } from "./treeBuilder.js";
import { $ } from "./ui.js";
import * as UI from "./ui.js";

const searchBarEl = $("searchBar"); // Item to move
const searchInputWrapper = $('searchInputWrapper')
const wholeWordsFilterWrapper = $('wholeWordsFilterWrapper')
const actorFilterWrapper = $('actorFilterWrapper')
const typeFilterWrapper = $('typeFilterWrapper')
const clearFilterWrapper = $('clearFilterWrapper')

const controlsEl = $("controls"); // Desktop Container
const mobileHeaderEl = $("mobileHeader"); // Mobile Container
const searchScreenControlsEl = $("searchScreenControls"); // Mobile Search Screen Container


const wholeWordsContainer = $("wholeWordsContainer"); // Item to move
const mobileSearchOptionsContainer = $("mobileSearchOptions"); // Mobile Container
const searchOptionsContainer = $("searchOptions"); // Desktop Container

const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const actorFilterBtn = $("actorFilterBtn");
const actorFilterLabel = $("actorFilterLabel");
const actorFilterDropdown = $("actorFilterDropdown");
const actorSearchInput = $("actorSearch");
const actorCheckboxList = $("actorCheckboxList");
const selectAllActors = $("selectAllActors");
const addToSelectionBtn = $("addToSelection");
const typeFilterBtn = $("typeFilterBtn");
const typeFilterLabel = $("typeFilterLabel");
const typeFilterDropdown = $("typeFilterDropdown");
const typeCheckboxList = $("typeCheckboxList");
const selectAllTypes = $("selectAllTypes");
const searchLoader = $("searchLoader");
const convoListEl = $("convoList");
const convoSearchInput = $("convoSearchInput");
const convoTypeFilterBtns = document.querySelectorAll(
  ".radio-button-group .radio-button"
);
const entryListEl = $("entryList");
const entryListHeaderEl = $("entryListHeader");
const entryDetailsEl = $("entryDetails");
const entryOverviewEl = $("entryOverview");
const currentEntryContainerEl = $("currentEntryContainer");
const chatLogEl = $("chatLog");
const backBtn = $("backBtn");
const backStatus = $("backStatus");
const convoRootBtn = $("convoRootBtn");
const moreDetailsEl = $("moreDetails");

// Sidebar elements
const sidebarOverlay = $("sidebarOverlay");

const mobileSearchBackBtnEl = $("mobileSearchBack");
const mobileRootBtn = $("mobileRootBtn");
const mobileHomeButtonEl = $("convoSearchHomeButton");

const mobileSidebarToggle = $("mobileSidebarToggle");

const conversationsSection = $("conversations-section"); // Item to move
const historySection = $("history-section"); // Item to move

const convoToggle = $("convoToggle");
const browserEl = $("browser"); // Desktop and Tablet Container

const historySidebarToggle = $("historySidebarToggle");
const historySidebar = $("historySidebar");
const historySidebarClose = $("historySidebarClose");
const chatLog = $("chatLog");

// Search option elements
const wholeWordsCheckbox = $("wholeWordsCheckbox");

// Mobile search elements
const mobileSearchScreen = $("mobileSearchScreen");
const mobileSearchBack = $("mobileSearchBack");
const mobileSearchResults = $("mobileSearchResults");
const mobileSearchLoader = $("mobileSearchLoader");
const mobileSearchCount = $("mobileSearchCount");
const mobileClearFilters = $("mobileClearFilters");
const mobileConvoFilter = $("mobileConvoFilter");
const mobileTypeFilter = $("mobileTypeFilter");
const mobileActorFilter = $("mobileActorFilter");
const mobileConvoFilterValue = $("mobileConvoFilterValue");
const mobileTypeFilterValue = $("mobileTypeFilterValue");
const mobileActorFilterValue = $("mobileActorFilterValue");
const mobileConvoFilterScreen = $("mobileConvoFilterScreen");
const mobileActorFilterScreen = $("mobileActorFilterScreen");
const mobileTypeFilterSheet = $("mobileTypeFilterSheet");

// Tree control elements
const expandAllBtn = $("expandAllBtn");
const collapseAllBtn = $("collapseAllBtn");

// Clear filters button
const clearFiltersBtn = $("clearFiltersBtn");

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
let selectedConvoIds = new Set();
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
let mobileSelectedConvoIds = new Set();
let mobileSelectedTypes = new Set(["all"]);
let mobileSelectedActorIds = new Set();

// Mobile actor filter state
let tempSelectedActorIds = new Set();
let filteredActorsForMobile = [];

// Mobile search pagination state
let mobileSearchQuery = "";
let mobileSearchActorIds = null;
let mobileSearchOffset = 0;
let mobileSearchTotal = 0;
let mobileSearchFilteredCount = 0;
let isMobileLoadingMore = false;

// Browser history state tracking
let currentAppState = "home"; // 'home', 'conversation', 'search'
let isHandlingPopState = false;

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

  // clear filters button
  setupClearFiltersButton();

  // Make header clickable to go home
  const headerTitle = document.querySelector("h1");
  if (headerTitle) {
    headerTitle.style.cursor = "pointer";
    headerTitle.addEventListener("click", () => {
      // Use browser history to go back to home
      if (currentConvoId !== null || currentAppState !== "home") {
        window.history.pushState(
          { view: "home" },
          "",
          window.location.pathname
        );
        goToHomeView();
      }
    });
  }

  // wire search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", handleSearchInputTrigger);
    searchInput.addEventListener("click", handleSearchInputTrigger);
    searchInput.addEventListener("keydown", handleSearchInputTrigger);
    
  }

  // Whole words toggle - trigger search when changed
  if (wholeWordsCheckbox) {
    wholeWordsCheckbox.addEventListener("change", () => {
      triggerSearch();
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Use browser back button instead of manual history management
      window.history.back();
    });
  }

  if (convoRootBtn) {
    convoRootBtn.addEventListener("click", () => {
      if (currentConvoId !== null) {
        jumpToConversationRoot();
      }
    });
  }

  updateBackButtonState();

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener("toggle", async function () {
      if (moreDetailsEl.open && currentConvoId && currentEntryId) {
        await showEntryDetails(
          currentConvoId,
          currentEntryId,
          currentAlternateCondition,
          currentAlternateLine
        );
        // Make dialogue options compact when More Details is expanded
        const entryListContainer = entryListEl?.closest(".entry-list");
        if (
          entryListContainer &&
          !entryListContainer.classList.contains("compact")
        ) {
          entryListContainer.setAttribute("data-was-expanded", "true");
          entryListContainer.classList.add("compact");
        }
        if (
          currentEntryContainerEl &&
          !currentEntryContainerEl.classList.contains("expanded")
        ) {
          currentEntryContainerEl.setAttribute("data-was-expanded", "true");
          currentEntryContainerEl.classList.add("expanded");
        }
      } else {
        // Restore original state when More Details is collapsed
        const entryListContainer = entryListEl?.closest(".entry-list");
        if (
          entryListContainer &&
          entryListContainer.getAttribute("data-was-expanded") === "true"
        ) {
          entryListContainer.classList.remove("compact");
          entryListContainer.removeAttribute("data-was-expanded");
        }
        if (
          currentEntryContainerEl &&
          currentEntryContainerEl.getAttribute("data-was-expanded") === "true"
        ) {
          currentEntryContainerEl.classList.remove("expanded");
          currentEntryContainerEl.removeAttribute("data-was-expanded");
        }
      }
    });
  }

  // Setup infinite scroll for search
  setupSearchInfiniteScroll();
  setupMobileSearchInfiniteScroll();

  // Setup mobile sidebar
  setupMobileSidebar();
  setUpSidebarToggles();

  // Setup unified filter panel (for refactored HTML)
  setupUnifiedFilterPanel();

  // Setup mobile search
  setupMobileSearch();

  // Initialize mobile filter labels
  updateMobileConvoFilterLabel();
  updateMobileActorFilterLabel();
  updateMobileTypeFilterLabel();

  // Setup browser history handling
  setupBrowserHistory();
}

// Define the media query that determines "mobile mode"
const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
const tabletMediaQuery = window.matchMedia(
  "(min-width: 769px) and (max-width: 1024px)"
);
const desktopMediaQuery = window.matchMedia("(min-width: 1025px)");

// Runs when the media query status changes
function handleMediaQueryChange() {
  setUpSidePanes()
  setUpSearchBarFilters()
}

function setUpSidePanes() {
  closeAllSidebars();
  if (desktopMediaQuery.matches) {
    toggleElementVisibilityById("historySidebarToggle", false);
    toggleElementVisibilityById("convoToggle", false);
    browserEl.prepend(conversationsSection);
    browserEl.append(historySection);
  } else if (tabletMediaQuery.matches) {
    toggleElementVisibilityById("historySidebarToggle", true);
    toggleElementVisibilityById("convoToggle", true);
    historySidebar.appendChild(historySection);
  } else if (mobileMediaQuery.matches) {
    toggleElementVisibilityById("historySidebarToggle", true);
    toggleElementVisibilityById("convoToggle", false);
    browserEl.prepend(conversationsSection);
    historySidebar.append(historySection);
  }
}

function setUpSearchBarFilters() {
  if(desktopMediaQuery.matches || tabletMediaQuery.matches) {
    searchBarEl.appendChild(searchInputWrapper)
    searchBarEl.appendChild(wholeWordsFilterWrapper)
    searchBarEl.appendChild(actorFilterWrapper)
    searchBarEl.appendChild(typeFilterWrapper)
    searchBarEl.appendChild(clearFilterWrapper)

    controlsEl.appendChild(searchBarEl)
    controlsEl.appendChild(searchLoader)
  }
  if(mobileMediaQuery.matches) {
    moveSearchInputToMobileHeader()
  }
} 
// Add the event listener to the MediaQueryList object
// The 'change' event fires when the matching status of the media query changes
desktopMediaQuery.addEventListener("change", handleMediaQueryChange);
tabletMediaQuery.addEventListener("change", handleMediaQueryChange);
mobileMediaQuery.addEventListener("change", handleMediaQueryChange);

// Call the function immediately on page load to check the initial state
handleMediaQueryChange();

function toggleElementVisibilityById(id, showElement) {
  const el = $(id);
  el.style.display = showElement ? "" : "none";
}

function setUpSidebarToggles() {
  convoToggle.addEventListener("click", openConversationSection);
  historySidebarToggle.addEventListener("click", openHistorySidebar);
  sidebarOverlay.addEventListener("click", closeAllSidebars);
}

function setupConversationFilter() {
  // Mobile home button
  if (mobileHomeButtonEl) {
    mobileHomeButtonEl.addEventListener("click", () => {
      closeAllSidebars();
      goToHomeView();
    });
  }

  // Text search filter
  if (convoSearchInput) {
    convoSearchInput.addEventListener("input", () => {
      filterConversationTree();
    });
  }

  // Type filter buttons
  convoTypeFilterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Update active state
      convoTypeFilterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active filter
      activeTypeFilter = btn.dataset.type;

      // Apply filter
      filterConversationTree();
    });
  });

  // Expand/Collapse all buttons
  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      expandAllTreeNodes();
    });
  }

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", () => {
      collapseAllTreeNodes();
    });
  }
}

function expandAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    const toggle = node.querySelector(".toggle");
    if (toggle && toggle.textContent && !node.classList.contains("expanded")) {
      node.classList.add("expanded");
      toggle.textContent = "▾";
    }
  });
}

function collapseAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    if (node.classList.contains("expanded")) {
      const toggle = node.querySelector(".toggle");
      node.classList.remove("expanded");
      if (toggle) {
        toggle.textContent = "▸";
      }
    }
  });
}

function filterConversationTree() {
  let searchText;
  if (!conversationTree) return;
  searchText = convoSearchInput?.value?.toLowerCase().trim() ?? "";

  // If no filters active, render the original tree
  if (!searchText && activeTypeFilter === "all") {
    renderTree(convoListEl, conversationTree);
    if (currentConvoId !== null) {
      highlightConversationInTree(currentConvoId);
    }
    return;
  }
  // TODO KA Do not render as flat list if the filter is just on convo type

  // Get all matching conversation leaves
  const matches = [];
  collectMatchingLeaves(
    conversationTree.root,
    searchText,
    activeTypeFilter,
    matches,
    conversationTree
  );

  // Clear and render matching results directly as a flat list
  convoListEl.innerHTML = "";

  if (matches.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "hint-text";
    noResults.textContent = "No matching conversations found.";
    convoListEl.appendChild(noResults);
    return;
  }

  // Render each match as a leaf item
  matches.forEach((match) => {
    const item = createFilteredLeafItem(match, searchText, conversationTree);
    convoListEl.appendChild(item);
  });
}

function collectMatchingLeaves(node, searchText, typeFilter, matches, tree) {
  // Check if this node has conversation IDs
  if (node.convoIds && node.convoIds.length > 0) {
    node.convoIds.forEach((cid) => {
      const convo = DB.getConversationById(cid);
      if (!convo) return;

      // Type filter
      if (typeFilter !== "all" && convo.type !== typeFilter) {
        return;
      }

      // Text filter
      if (searchText) {
        const titleMatch = convo.displayTitle
          .toLowerCase()
          .includes(searchText);
        const idMatch = cid.toString().includes(searchText);
        if (titleMatch || idMatch) {
          matches.push({
            convoId: cid,
            title: convo.displayTitle,
            type: convo.type || "flow",
          });
        }
      } else {
        matches.push({
          convoId: cid,
          title: convo.displayTitle,
          type: convo.type || "flow",
        });
      }
    });
  }

  // Recursively search children
  if (node.children) {
    for (const child of node.children.values()) {
      collectMatchingLeaves(child, searchText, typeFilter, matches, tree);
    }
  }
}

function createFilteredLeafItem(match, searchText, tree) {
  const wrapper = document.createElement("div");
  wrapper.className = "node leaf-result";

  const label = document.createElement("div");
  label.className = "label";
  label.dataset.convoId = match?.convoId;

  // No toggle for leaf items
  const toggle = document.createElement("span");
  toggle.className = "toggle";
  label.appendChild(toggle);

  const titleSpan = document.createElement("span");

  // Highlight matching text
  if (searchText) {
    const titleLower = match?.title?.toLowerCase();
    const index = titleLower.indexOf(searchText);
    if (index !== -1) {
      const before = match?.title?.substring(0, index);
      const highlighted = match?.title?.substring(
        index,
        index + searchText.length
      );
      const after = match?.title?.substring(index + searchText.length);

      titleSpan.innerHTML = `${escapeHtml(
        before
      )}<mark class="yellow-highlighting">${escapeHtml(
        highlighted
      )}</mark>${escapeHtml(after)}`;
    } else {
      titleSpan.textContent = match?.title;
    }
  } else {
    titleSpan.textContent = match?.title;
  }

  label.appendChild(titleSpan);

  // Add type badge
  if (match?.type !== "flow") {
    const badge = document.createElement("span");
    badge.className = `type-badge type-${match?.type}`;
    badge.textContent = match?.type?.toUpperCase();
    label.appendChild(badge);
  }

  // Apply highlight class based on type
  if (match?.type !== "flow") {
    label.classList.add(`highlight-${match?.type}`);
  }

  wrapper.appendChild(label);

  // Click handler to load conversation
  label.addEventListener("click", (ev) => {
    ev.stopPropagation();
    label.dispatchEvent(
      new CustomEvent("convoLeafClick", {
        detail: { convoId: match?.convoId },
        bubbles: true,
      })
    );
  });

  return wrapper;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
    if (
      !actorFilterDropdown.contains(e.target) &&
      e.target !== actorFilterBtn
    ) {
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
      const checkboxes = actorCheckboxList.querySelectorAll(
        'input[type="checkbox"]'
      );

      checkboxes.forEach((cb) => {
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
      const checkboxes = actorCheckboxList.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      checkboxes.forEach((cb) => {
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
  const searchText = actorSearchInput
    ? actorSearchInput.value.toLowerCase().trim()
    : "";

  if (!searchText) {
    filteredActors = [...allActors];
  } else {
    filteredActors = allActors.filter((actor) => {
      return (
        actor.name.toLowerCase().includes(searchText) ||
        actor.id.toString().includes(searchText)
      );
    });
  }

  renderActorCheckboxes(filteredActors);
  updateSelectAllState();
}

function renderActorCheckboxes(actors) {
  actorCheckboxList.innerHTML = "";

  actors.forEach((actor) => {
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

  const visibleCheckboxes = actorCheckboxList.querySelectorAll(
    'input[type="checkbox"]'
  );
  const visibleActorIds = Array.from(visibleCheckboxes).map((cb) =>
    parseInt(cb.dataset.actorId)
  );

  const allSelected =
    visibleActorIds.length > 0 &&
    visibleActorIds.every((id) => selectedActorIds.has(id));
  const someSelected = visibleActorIds.some((id) => selectedActorIds.has(id));

  selectAllActors.checked = allSelected;
  selectAllActors.indeterminate = !allSelected && someSelected;
}

function updateActorFilterLabel() {
  if (!actorFilterLabel) return;

  if (
    selectedActorIds.size === 0 ||
    selectedActorIds.size === allActors.length
  ) {
    actorFilterLabel.textContent = "All Actors";
  } else if (selectedActorIds.size === 1) {
    const actorId = Array.from(selectedActorIds)[0];
    const actor = allActors.find((a) => a.id === actorId);
    actorFilterLabel.textContent = actor ? actor.name : "1 Actor";
  } else {
    actorFilterLabel.textContent = `${selectedActorIds.size} Actors`;
  }
}

function triggerSearch() {
  if (searchInput.value) {
    // Always reset search when filters change to clear old results
    // But only push history state if not already in search view
    const isAlreadySearching = currentAppState === "search";
    if (isAlreadySearching) {
      // Already in search view, manually reset and search without pushing history
      currentSearchOffset = 0;
      currentSearchFilteredCount = 0;
      entryListEl.innerHTML = "";
      searchDialogues(searchInput.value, false);
    } else {
      // First time searching, push history state
      searchDialogues(searchInput.value, true);
    }
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
      const checkboxes = typeCheckboxList.querySelectorAll(
        'input[type="checkbox"][data-type]'
      );

      checkboxes.forEach((cb) => {
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
  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]'
  );
  typeCheckboxes.forEach((cb) => {
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

  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]'
  );
  const allTypes = Array.from(typeCheckboxes).map((cb) => cb.dataset.type);

  const allSelected =
    allTypes.length > 0 && allTypes.every((type) => selectedTypeIds.has(type));
  const someSelected = allTypes.some((type) => selectedTypeIds.has(type));

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

function openHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.add("open");
    historySidebar.style.display = "";
  }
  if (historySidebarClose) {
    historySidebarClose.addEventListener("click", closeHistorySidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = "block";
  }
}

function closeHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.remove("open");
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = "none";
  }
}

function closeConversationSection() {
  if (conversationsSection) {
    conversationsSection.classList.remove("open");
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = "none";
  }
}

function openConversationSection(e) {
  e.preventDefault();
  e.stopPropagation();
  if (conversationsSection) {
    conversationsSection.classList.add("open");
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = "block";
  }
}

function closeSearchScreen() {
  if (mobileSearchScreen) {
    mobileSearchScreen.style.display = "none";
  }
  moveSearchInputToMobileHeader()
}

function moveSearchInputToMobileHeader() {
    if(mobileHeaderEl && mobileMediaQuery.matches) {
      mobileHeaderEl.appendChild(mobileSidebarToggle);
      mobileHeaderEl.appendChild(searchBarEl);
      mobileHeaderEl.appendChild(mobileHomeButtonEl);
    }
}

function moveSearchInputToSearchScreen() {
  if (mobileSearchScreen && mobileMediaQuery.matches) {
    mobileSearchScreen.style.display = "block";
    searchScreenControlsEl.appendChild(searchBarEl);
    searchInput.focus();
  }
}

function openSearchScreen() {
  // Push browser history state for mobile search
  if (!mobileMediaQuery.matches) return;
  if (!isHandlingPopState) {
    pushHistoryState("search");
  }
  moveSearchInputToSearchScreen()
}

// Setup clear filters button
function setupClearFiltersButton() {
  if (!clearFiltersBtn) return;

  clearFiltersBtn.addEventListener("click", () => {
    // Reset actor filters
    selectedActorIds.clear();
    const actorCheckboxes = actorCheckboxList?.querySelectorAll(
      'input[type="checkbox"]'
    );
    if (actorCheckboxes) {
      actorCheckboxes.forEach((cb) => {
        cb.checked = false;
      });
    }
    if (selectAllActors) {
      selectAllActors.checked = false;
    }
    updateActorFilterLabel();

    // Reset type filters - select all
    selectedTypeIds.clear();
    selectedTypeIds.add("flow");
    selectedTypeIds.add("orb");
    selectedTypeIds.add("task");

    const typeCheckboxes = typeCheckboxList?.querySelectorAll(
      'input[type="checkbox"][data-type]'
    );
    if (typeCheckboxes) {
      typeCheckboxes.forEach((cb) => {
        cb.checked = true;
      });
    }
    if (selectAllTypes) {
      selectAllTypes.checked = true;
      selectAllTypes.indeterminate = false;
    }
    updateTypeFilterLabel();

    // Trigger search with cleared filters
    triggerSearch();
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

  // If we're coming from home (no current conversation), ensure home state exists
  if (!isHandlingPopState && currentConvoId === null) {
    // Replace current state with home before pushing conversation
    window.history.replaceState({ view: "home" }, "", window.location.pathname);
  }

  // Push browser history state (unless we're handling a popstate event)
  if (!isHandlingPopState) {
    pushHistoryState("conversation", { convoId });
  }

  // Close mobile sidebar when conversation is selected
  closeAllSidebars();

  // If switching conversations or resetting, clear the chat log
  if (resetHistory || (currentConvoId !== null && currentConvoId !== convoId)) {
    navigationHistory = [{ convoId, entryId: null }];
    if (chatLogEl) {
      chatLogEl.innerHTML = "";
    }
    if (chatLog) {
      chatLog.innerHTML = "";
    }
  } else if (resetHistory) {
    navigationHistory = [{ convoId, entryId: null }];
  }

  if (currentEntryContainerEl) currentEntryContainerEl.style.display = "flex";

  // Hide homepage, show dialogue content

  const homePageContainer = document.getElementById("homePageContainer");
  const dialogueContent = document.getElementById("dialogueContent");

  if (homePageContainer) {
    homePageContainer.style.display = "none";
  }
  if (dialogueContent) {
    dialogueContent.style.display = "flex";
  }

  // Remove search mode styling
  const entryListContainer = entryListEl?.closest(".entry-list");
  if (entryListContainer) entryListContainer.classList.remove("full-height");

  // Reset search state to prevent infinite scroll from loading more search results
  currentSearchOffset = 0;
  currentSearchTotal = 0;
  currentSearchFilteredCount = 0;

  // Update current state for conversation root
  currentConvoId = convoId;
  currentEntryId = null;

  // Hide root button at conversation root
  if (convoRootBtn) {
    convoRootBtn.style.display = "none";
  }
  if (convoRootBtn) {
    convoRootBtn.style.display = "none";
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
  const convoType = conversation?.type || "flow";

  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";

  if (convoType === "orb" || convoType === "task") {
    // Orbs and tasks don't have dialogue options - make the section compact
    entryListEl.classList.add("compact");
    // Expand the current entry container to use more space
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add("expanded");
    }
    const message = document.createElement("div");
    message.className = "hint-text";
    message.style.fontStyle = "italic";
    message.style.padding = "12px";
    message.innerHTML = `This is ${
      convoType === "orb" ? "an" : "a"
    } <strong>${convoType.toUpperCase()}</strong> and does not have dialogue options.`;
    entryListEl.appendChild(message);
    return;
  }

  // For flows, remove compact class and expanded class
  entryListEl.classList.remove("compact");
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove("expanded");
  }

  const rows = DB.getEntriesForConversation(convoId);
  const filtered = rows.filter(
    (r) => (r.title || "").toLowerCase() !== "start"
  );
  if (!filtered.length) {
    // No entries - make compact like orbs/tasks
    entryListEl.classList.add("compact");
    const entryList = entryListEl.closest(".entry-list");
    if (entryList) entryList.classList.add("compact");
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add("expanded");
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
  entryListEl.classList.remove("compact");
  const entryList = entryListEl.closest(".entry-list");
  if (entryList) entryList.classList.remove("compact");
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove("expanded");
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
      backStatus.textContent = `(${navigationHistory.length - 1} step${
        navigationHistory.length - 1 !== 1 ? "s" : ""
      })`;
    } else {
      backStatus.textContent = "";
    }
  }
}

// Browser History Management
function setupBrowserHistory() {
  // Set initial state
  window.history.replaceState({ view: "home" }, "", window.location.pathname);
  currentAppState = "home";

  // Handle browser back/forward buttons
  window.addEventListener("popstate", async (event) => {
    if (isHandlingPopState) return;
    isHandlingPopState = true;

    const state = event.state;

    // Always close mobile search screen if it's open (when navigating via back button)
    closeSearchScreen();

    if (!state || state.view === "home") {
      // Go back to home view
      goToHomeView();
    } else if (state.view === "conversation") {
      if (state.convoId && state.entryId) {
        // Going to a specific entry
        // Determine if we're going backwards or forwards
        const isGoingBack =
          navigationHistory.length > 0 &&
          navigationHistory[navigationHistory.length - 1] &&
          (navigationHistory[navigationHistory.length - 1].convoId !==
            state.convoId ||
            navigationHistory[navigationHistory.length - 1].entryId !==
              state.entryId);

        if (isGoingBack) {
          // Going backwards - remove current entry (non-clickable) and the last clickable entry
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild); // Remove current
          }
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild); // Remove last clickable
          }
          navigationHistory.pop();
        }

        // Navigate to the entry
        await navigateToEntry(state.convoId, state.entryId, !isGoingBack);
      } else if (state.convoId) {
        // Going to conversation root
        const isGoingBack = navigationHistory.length > 1;

        if (isGoingBack) {
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild); // Remove current
          }
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild); // Remove last clickable
          }
          navigationHistory.pop();
        }

        loadEntriesForConversation(state.convoId, false);
      }
    } else if (state.view === "search") {
      // Going back to search should actually go to home since search is a "forward" action
      goToHomeView();
    }

    currentAppState = state?.view || "home";

    // Update UI state
    updateBackButtonState();
    if (typeof updateMobileNavButtons === "function") {
      updateMobileNavButtons();
    }

    setTimeout(() => {
      isHandlingPopState = false;
    }, 100);
  });
}

function pushHistoryState(view, data = {}) {
  if (isHandlingPopState) return;

  const state = { view, ...data };
  currentAppState = view;
  window.history.pushState(state, "", window.location.pathname);
}

function goToHomeView() {
  // Clear current conversation
  currentConvoId = null;
  currentEntryId = null;
  navigationHistory = [];

  // Clear chat log
  if (chatLogEl) {
    chatLogEl.innerHTML = "";
  }
  if (chatLog) {
    chatLog.innerHTML = "";
  }

  // Show homepage, hide dialogue content
  const homePageContainer = document.getElementById("homePageContainer");
  const dialogueContent = document.getElementById("dialogueContent");

  if (homePageContainer) {
    homePageContainer.style.display = "block";
  }
  if (dialogueContent) {
    dialogueContent.style.display = "none";
  }

  // Reset entry list header
  if (entryListHeaderEl) {
    entryListHeaderEl.textContent = "Next Dialogue Options";
  }

  // Clear tree selection
  document.querySelectorAll(".tree-item.selected").forEach((item) => {
    item.classList.remove("selected");
  });

  // Close mobile search if open
  closeSearchScreen();

  updateBackButtonState();
}

/* Jump back to a specific point in history by removing all entries after it */
async function jumpToHistoryPoint(targetIndex) {
  if (targetIndex < 0 || targetIndex >= navigationHistory.length) return;

  // If clicking on the last item, do nothing (it's the current entry)
  if (targetIndex === navigationHistory.length - 1) return;

  // Remove all chat log items after the target (including current entry display)
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll(".card-item");
    const itemsToRemove = historyItems.length - targetIndex - 1;
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
    const title = coreRow
      ? coreRow.title
      : `(line ${currentConvoId}:${currentEntryId})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";

    // Get conversation type
    const conversation = DB.getConversationById(currentConvoId);
    const convoType = conversation?.type || "flow";

    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);

    // Add current entry to history log (non-clickable)
    if (chatLogEl) {
      const currentTitle = UI.parseSpeakerFromTitle(title) || "(no title)";
      UI.appendHistoryItem(
        chatLogEl,
        `${currentTitle} — #${eid}`,
        dialoguetext,
        targetIndex,
        null, // null means non-clickable
        chatLog
      );
    }

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
    historyItems.forEach((item) => item.remove());
  }

  // Reset to just the conversation root
  navigationHistory = [{ convoId: currentConvoId, entryId: null }];

  // Load the conversation root
  loadEntriesForConversation(currentConvoId, false);
  highlightConversationInTree(currentConvoId);
  updateBackButtonState();
}

/* navigateToEntry simplified */
async function navigateToEntry(
  convoId,
  entryId,
  addToHistory = true,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  // Ensure numeric Ids
  convoId = UI.getParsedIntOrDefault(convoId);
  entryId = UI.getParsedIntOrDefault(entryId);

  // Push browser history state (unless we're handling a popstate event)
  if (!isHandlingPopState && addToHistory) {
    pushHistoryState("conversation", { convoId, entryId });
  }

  // Check if we're at the same entry AND same alternate view
  const sameEntry = currentConvoId === convoId && currentEntryId === entryId;
  const sameAlternate =
    currentAlternateCondition === selectedAlternateCondition &&
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

  // Hide homepage, show dialogue content (important for mobile when coming from search)
  const homePageContainer = document.getElementById("homePageContainer");
  const dialogueContent = document.getElementById("dialogueContent");

  if (homePageContainer) {
    homePageContainer.style.display = "none";
  }
  if (dialogueContent) {
    dialogueContent.style.display = "flex";
  }

  // Make visible
  if (currentEntryContainerEl) {
    currentEntryContainerEl.style.overflowY = "auto";
    currentEntryContainerEl.style.display = "flex";
    currentEntryContainerEl.style.visibility = "visible";
    currentEntryContainerEl.style.flex = "0 0 auto";
  }

  // Also restore entry list layout when navigating from search
  const entryListContainer = entryListEl?.closest(".entry-list");
  if (entryListContainer) {
    entryListContainer.classList.remove("full-height");
  }

  // Reset search state to prevent infinite scroll from loading more search results
  currentSearchOffset = 0;
  currentSearchTotal = 0;
  currentSearchFilteredCount = 0;

  // Clear the hint text if present
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes("(navigation log")
    )
      chatLogEl.innerHTML = "";
  }

  if (chatLog) {
    if (
      chatLog.children.length === 1 &&
      chatLog.children[0].textContent &&
      chatLog.children[0].textContent.includes("(navigation log")
    )
      chatLog.innerHTML = "";
  }

  // Remove the previous "current entry" display if it exists (it will become clickable)
  if (addToHistory && chatLogEl && chatLogEl.lastElementChild) {
    const lastItem = chatLogEl.lastElementChild;
    if (lastItem.classList.contains("current-entry")) {
      // Make it clickable before adding new current entry
      lastItem.classList.remove("current-entry");
      lastItem.style.cursor = "pointer";
      const historyIndex = parseInt(lastItem.dataset.historyIndex);
      lastItem.addEventListener("click", () => {
        jumpToHistoryPoint(historyIndex);
      });
    }
  }

  if (addToHistory) navigationHistory.push({ convoId, entryId });
  updateBackButtonState();

  // Render current entry in the overview section
  const coreRow = DB.getEntry(convoId, entryId);
  const title = coreRow ? coreRow.title : `(line ${convoId}:${entryId})`;
  // Use alternate line if provided, otherwise use the original dialogue text
  const dialoguetext =
    selectedAlternateLine || (coreRow ? coreRow.dialoguetext : "");

  // Get conversation type
  const conversation = DB.getConversationById(convoId);
  const convoType = conversation?.type || "flow";

  UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType);

  currentConvoId = convoId;
  currentEntryId = entryId;
  currentAlternateCondition = selectedAlternateCondition;
  currentAlternateLine = selectedAlternateLine;

  // Add current entry to history log (non-clickable)
  if (addToHistory && chatLogEl) {
    const currentTitle = UI.parseSpeakerFromTitle(title) || "(no title)";
    UI.appendHistoryItem(
      chatLogEl,
      `${currentTitle} — #${entryId}`,
      dialoguetext,
      navigationHistory.length - 1,
      null, // null means non-clickable
      chatLog
    );
  }

  // Show More Details for actual entries (they have dentries)
  if (moreDetailsEl) {
    moreDetailsEl.style.display = "block";
  }

  // Show/hide root button
  if (convoRootBtn) {
    convoRootBtn.style.display =
      currentEntryId !== null ? "inline-block" : "none";
  }
  if (convoRootBtn) {
    convoRootBtn.style.display =
      currentEntryId !== null ? "inline-block" : "none";
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
    await showEntryDetails(
      convoId,
      entryId,
      selectedAlternateCondition,
      selectedAlternateLine
    );
  }
}

/* Show entry details (optimized) */
async function showEntryDetails(
  convoId,
  entryId,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  if (!DB || !entryDetailsEl) return;

  // Check cache only if viewing the original (no alternate selected)
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const cached = DB.getCachedEntry(convoId, entryId);
    if (cached) {
      UI.renderEntryDetails(entryDetailsEl, {
        ...cached,
        selectedAlternateCondition: null,
        selectedAlternateLine: null,
        originalDialogueText:
          cached.originalDialogueText || entry?.dialoguetext,
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
    conversationTitle: convoRow.displayTitle,
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
function searchDialogues(resetSearch = true) {
  const q = searchInput.value.trim();

  if (resetSearch) {
    // Push browser history state for search view
    if (!isHandlingPopState) {
      pushHistoryState("search", { query: q });
    }

    // Starting a new search
    currentSearchQuery = q;
    currentSearchOffset = 0;
  }

  // Always update actor IDs from current filter selection (even when re-filtering)
  currentSearchActorIds =
    selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
      ? null
      : Array.from(selectedActorIds);

  if (resetSearch) {
    if (searchLoader) searchLoader.style.display = "flex";

    // Hide homepage, show dialogue content for search
    const homePageContainer = document.getElementById("homePageContainer");
    const dialogueContent = document.getElementById("dialogueContent");

    if (homePageContainer) {
      homePageContainer.style.display = "none";
    }
    if (dialogueContent) {
      dialogueContent.style.display = "flex";
    }

    // Hide current entry and make search take full space
    if (currentEntryContainerEl) currentEntryContainerEl.style.display = "none";
    const entryListContainer = entryListEl.closest(".entry-list");
    if (entryListContainer) {
      entryListContainer.classList.add("full-height");
      entryListContainer.classList.remove("compact");
    }
    if (entryListEl) {
      entryListEl.classList.remove("compact");
    }

    entryListEl.innerHTML = ""; // This clears both innerHTML and textContent
  }

  if (isLoadingMore) return;
  isLoadingMore = true;

  try {
    const response = DB.searchDialogues(
      currentSearchQuery,
      searchResultLimit,
      currentSearchActorIds,
      true, // filterStartInput
      currentSearchOffset,
      undefined, // conversationIds
      wholeWordsCheckbox?.checked || false // wholeWords
    );

    const { results: res, total } = response;
    currentSearchTotal = total;

    // Filter by conversation type if not all types selected
    let filteredResults = res;
    if (selectedTypeIds.size > 0 && selectedTypeIds.size < 3) {
      filteredResults = res.filter((r) => {
        const convo = DB.getConversationById(r.conversationid);
        const type = convo ? convo.type || "flow" : "flow";
        return selectedTypeIds.has(type);
      });
    }

    if (resetSearch) {
      entryListHeaderEl.textContent = "Search Results";
      entryListEl.innerHTML = "";
      currentSearchFilteredCount = 0;

      if (!filteredResults.length) {
        entryListEl.innerHTML = "<div>(no matches)</div>";
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
      // Check if query contains any quoted phrases
      const hasQuotedPhrases = /"[^"]+"/g.test(currentSearchQuery);

      // For highlighting, if there are quoted phrases, we need special handling
      // Otherwise use the normal query
      const highlightedTitle = UI.highlightTerms(
        r.title || "",
        currentSearchQuery,
        hasQuotedPhrases
      );
      const highlightedText = UI.highlightTerms(
        r.dialoguetext || "",
        currentSearchQuery,
        hasQuotedPhrases
      );

      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid);
      const convoType = convo ? convo.type || "flow" : "flow";

      const div = UI.createCardItem(
        highlightedTitle,
        UI.getParsedIntOrDefault(r.conversationid),
        r.id,
        highlightedText,
        true,
        convoType
      );

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
          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
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
    const oldLoadingIndicator = entryListEl.querySelector(
      ".search-loading-indicator"
    );
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

  entryListEl.addEventListener("scroll", () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = entryListEl.scrollTop;
    const scrollHeight = entryListEl.scrollHeight;
    const clientHeight = entryListEl.clientHeight;

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (
      scrolledToBottom &&
      !isLoadingMore &&
      currentSearchOffset < currentSearchTotal
    ) {
      // Remove loading indicator
      const loadingIndicator = entryListEl.querySelector(
        ".search-loading-indicator"
      );
      if (loadingIndicator) loadingIndicator.remove();

      // Load more results
      searchDialogues(currentSearchQuery, false);
    }
  });
}

// Setup infinite scroll for mobile search results
function setupMobileSearchInfiniteScroll() {
  if (!mobileSearchResults) return;

  mobileSearchResults.addEventListener("scroll", () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = mobileSearchResults.scrollTop;
    const scrollHeight = mobileSearchResults.scrollHeight;
    const clientHeight = mobileSearchResults.clientHeight;

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (
      scrolledToBottom &&
      !isMobileLoadingMore &&
      mobileSearchOffset < mobileSearchTotal
    ) {
      // Remove loading indicator
      const loadingIndicator = mobileSearchResults.querySelector(
        ".mobile-search-loading-indicator"
      );
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

      const el = UI.createCardItem(
        dest.title,
        c.d_convo,
        c.d_id,
        dest.dialoguetext
      );
      el.addEventListener("click", () => navigateToEntry(c.d_convo, c.d_id));
      entryListEl.appendChild(el);
    }

    if (entryListEl.children.length === 0) {
      // No further options - make compact like orbs/tasks
      entryListEl.classList.add("compact");
      const entryList = entryListEl.closest(".entry-list");
      if (entryList) entryList.classList.add("compact");
      if (currentEntryContainerEl) {
        currentEntryContainerEl.classList.add("expanded");
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

/* Unified Filter Panel Handler (for refactored HTML) */
function setupUnifiedFilterPanel() {
  const filterPanel = $("filterPanel");
  const filterBackBtn = document.querySelector(".filter-back-btn");
  const filterPanelTitle = $("filterPanelTitle");
  const filterSearch = $("filterSearch");
  const filterSelectAll = $("filterSelectAll");
  const filterApply = $("filterApply");
  const filterList = $("filterList");
  const actorFilterChip = $("actorFilterChip");
  const typeFilterChip = $("typeFilterChip");

  if (!filterPanel) return; // Skip if new filter panel doesn't exist

  let currentFilterType = null; // 'actor' or 'type'
  let tempSelection = new Set();

  // Handle filter chip clicks
  if (actorFilterChip) {
    actorFilterChip.addEventListener("click", () => {
      openFilterPanel("actor");
    });
  }

  if (typeFilterChip) {
    typeFilterChip.addEventListener("click", () => {
      openFilterPanel("type");
    });
  }

  // Handle back button
  if (filterBackBtn) {
    filterBackBtn.addEventListener("click", () => {
      filterPanel.style.display = "none";
      currentFilterType = null;
    });
  }

  // Handle apply button
  if (filterApply) {
    filterApply.addEventListener("click", () => {
      if (currentFilterType === "actor") {
        mobileSelectedActorIds = new Set(tempSelection);
        updateMobileActorFilterLabel();
        updateFilterChipDisplay("actor");
      } else if (currentFilterType === "type") {
        mobileSelectedTypes = new Set(tempSelection);
        updateMobileTypeFilterLabel();
        updateFilterChipDisplay("type");
      }
      filterPanel.style.display = "none";
      currentFilterType = null;
    });
  }

  // Handle select all checkbox
  if (filterSelectAll) {
    filterSelectAll.addEventListener("change", () => {
      const checkboxes = filterList.querySelectorAll('input[type="checkbox"]');
      if (filterSelectAll.checked) {
        checkboxes.forEach((cb) => {
          cb.checked = true;
          const item = cb.closest(".checkbox-item");
          if (item) {
            const id = item.dataset.id;
            if (id) tempSelection.add(id);
          }
        });
      } else {
        checkboxes.forEach((cb) => (cb.checked = false));
        tempSelection.clear();
      }
    });
  }

  function openFilterPanel(filterType) {
    currentFilterType = filterType;
    tempSelection = new Set(
      filterType === "actor"
        ? mobileSelectedActorIds
        : filterType === "type"
        ? mobileSelectedTypes
        : []
    );

    // Set title
    if (filterPanelTitle) {
      filterPanelTitle.textContent =
        filterType === "actor" ? "Select Actors" : "Select Types";
    }

    // Show/hide disclaimer
    const disclaimer = $("filterDisclaimer");
    if (disclaimer) {
      disclaimer.style.display = filterType === "actor" ? "block" : "none";
    }

    // Populate list
    filterList.innerHTML = "";

    if (filterType === "actor") {
      // Render actor list
      allActors.forEach((actor) => {
        const label = document.createElement("label");
        label.className = "checkbox-item";
        label.dataset.id = actor.id;
        const isSelected = mobileSelectedActorIds.has(actor.id);
        label.innerHTML = `
          <input type="checkbox" ${isSelected ? "checked" : ""} />
          <span>${actor.name}</span>
        `;
        label.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) {
            tempSelection.add(actor.id);
          } else {
            tempSelection.delete(actor.id);
          }
          updateSelectAllState();
        });
        filterList.appendChild(label);
      });
    } else if (filterType === "type") {
      // Render type list
      const types = ["flow", "orb", "task"];
      const hasAll = mobileSelectedTypes.has("all");

      types.forEach((type) => {
        const label = document.createElement("label");
        label.className = "checkbox-item";
        label.dataset.id = type;
        const isSelected = hasAll || mobileSelectedTypes.has(type);
        label.innerHTML = `
          <input type="checkbox" ${isSelected ? "checked" : ""} />
          <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
        `;
        label.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) {
            tempSelection.add(type);
            tempSelection.delete("all");
          } else {
            tempSelection.delete(type);
          }
          updateSelectAllState();
        });
        filterList.appendChild(label);
      });
    }

    updateSelectAllState();
    filterPanel.style.display = "block";
  }

  function updateSelectAllState() {
    if (!filterSelectAll) return;
    const checkboxes = Array.from(
      filterList.querySelectorAll('input[type="checkbox"]')
    );
    const checkedCount = checkboxes.filter((cb) => cb.checked).length;
    filterSelectAll.checked =
      checkedCount === checkboxes.length && checkboxes.length > 0;
    filterSelectAll.indeterminate =
      checkedCount > 0 && checkedCount < checkboxes.length;
  }

  // Handle search in filter panel
  if (filterSearch) {
    filterSearch.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const items = filterList.querySelectorAll(".checkbox-item");
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? "block" : "none";
      });
    });
  }

  function updateFilterChipDisplay(filterType) {
    if (filterType === "actor") {
      const chip = $("actorFilterChip");
      if (chip) {
        const valueSpan = chip.querySelector(".filter-value");
        if (valueSpan) {
          if (mobileSelectedActorIds.size === 0) {
            valueSpan.textContent = "";
          } else if (mobileSelectedActorIds.size === 1) {
            const actorId = Array.from(mobileSelectedActorIds)[0];
            const actor = allActors.find((a) => a.id === actorId);
            valueSpan.textContent = actor ? actor.name : `1 Actor`;
          } else {
            valueSpan.textContent = `${mobileSelectedActorIds.size} Actors`;
          }
        }
      }
    } else if (filterType === "type") {
      const chip = $("typeFilterChip");
      if (chip) {
        const valueSpan = chip.querySelector(".filter-value");
        if (valueSpan) {
          if (
            mobileSelectedTypes.has("all") ||
            mobileSelectedTypes.size === 0
          ) {
            valueSpan.textContent = "";
          } else if (mobileSelectedTypes.size === 1) {
            const type = Array.from(mobileSelectedTypes)[0];
            valueSpan.textContent =
              type.charAt(0).toUpperCase() + type.slice(1);
          } else {
            valueSpan.textContent = `${mobileSelectedTypes.size} Types`;
          }
        }
      }
    }
  }
}

function handleSearchInputTrigger(e) {
  if (e.type === "click" || e.key === "Enter") {
    if (mobileMediaQuery.matches) {
      openSearchScreen();
      performMobileSearch();
    } else if (tabletMediaQuery.matches || desktopMediaQuery.matches) {
      searchDialogues(searchInput.value);
    }
  }
}

function handleSearchBackButtonClick() {
  if (mobileMediaQuery.matches) {
    closeSearchScreen();
  }
}

/* Mobile Search Functions */
function setupMobileSearch() {
  // Close mobile search screen
  mobileSearchBack.addEventListener("click", handleSearchBackButtonClick);

  // Whole words toggle - trigger search when changed
  wholeWordsCheckbox.addEventListener("change", handleSearchInputTrigger);

  // Clear filters button
  if (mobileClearFilters) {
    mobileClearFilters.addEventListener("click", () => {
      // Clear conversation filter
      mobileSelectedConvoIds.clear();
      if (mobileConvoFilterValue) mobileConvoFilterValue.textContent = "All";

      // Clear type filter
      mobileSelectedTypes.clear();
      mobileSelectedTypes.add("all");
      if (mobileTypeFilterValue) mobileTypeFilterValue.textContent = "All";

      // Clear actor filter
      mobileSearchActorIds = null;
      if (mobileActorFilterValue) mobileActorFilterValue.textContent = "All";

      // Clear whole words
      if (wholeWordsCheckbox) {
        wholeWordsCheckbox.checked = false;
      }

      // Re-run search if there's an active query
      if (mobileSearchQuery) {
        performMobileSearch();
      }
    });
  }

  // Filter: Convos, Type, Actor
  mobileConvoFilter.addEventListener("click", showMobileConvoFilter);
  mobileTypeFilter.addEventListener("click", showMobileTypeFilter);
  mobileActorFilter.addEventListener("click", showMobileActorFilter);

  setupMobileConvoFilter();
  setupMobileActorFilter();
  setupMobileTypeFilter();
}

function setupMobileSidebar() {
  // Open sidebar
  mobileSidebarToggle.addEventListener("click", openConversationSection);
  convoToggle.addEventListener("click", openConversationSection);

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
  if (!mobileSearchBackBtnEl || !mobileRootBtn) return;

  // Show back button if we have navigation history OR if we're not on home view
  if (
    navigationHistory.length > 1 ||
    currentConvoId !== null ||
    currentAppState !== "home"
  ) {
    // mobileSearchBackBtnEl.style.display = "flex";
    mobileSearchBackBtnEl.style.display = "none";
  } else {
    mobileSearchBackBtnEl.style.display = "none";
  }

  // Show root button if we're not at conversation root
  if (currentEntryId !== null) {
    mobileRootBtn.style.display = "none";
    // mobileRootBtn.style.display = "flex";
  } else {
    mobileRootBtn.style.display = "none";
  }
}

function closeAllSidebars() {
  closeConversationSection();
  closeHistorySidebar();
  closeSearchScreen();
}

function performMobileSearch(resetSearch = true) {
  const query = searchInput.value.trim();

  if (resetSearch) {
    // Starting a new search
    mobileSearchQuery = query;
    mobileSearchActorIds =
      mobileSelectedActorIds.size === 0 ||
      mobileSelectedActorIds.size === allActors.length
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
      searchResultLimit,
      mobileSearchActorIds,
      true,
      mobileSearchOffset,
      undefined, // conversationIds
      wholeWordsCheckbox?.checked || false // wholeWords
    );
    const { results, total } = response;
    mobileSearchTotal = total;

    // Filter by conversations if selected
    let filteredResults = results;
    if (mobileSelectedConvoIds.size > 0) {
      filteredResults = results.filter((r) =>
        mobileSelectedConvoIds.has(r.conversationid)
      );
    }

    // Filter by type if not "all"
    if (!mobileSelectedTypes.has("all")) {
      filteredResults = filteredResults.filter((r) => {
        const convo = DB.getConversationById(r.conversationid);
        return convo && mobileSelectedTypes.has(convo.type || "flow");
      });
    }

    mobileSearchLoader.style.display = "none";

    if (resetSearch) {
      mobileSearchFilteredCount = 0;
    }

    if (resetSearch && filteredResults.length === 0) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">No results found</div>';
      if (mobileSearchCount) {
        mobileSearchCount.style.display = "none";
      }
      return;
    }

    // Update filtered count
    mobileSearchFilteredCount += filteredResults.length;

    // Update count display
    if (mobileSearchCount) {
      if (mobileSelectedConvoIds.size > 0 || !mobileSelectedTypes.has("all")) {
        // Show filtered count when filters are active
        mobileSearchCount.textContent = `${mobileSearchFilteredCount} results (filtered)`;
      } else {
        // Show total count when no filters
        mobileSearchCount.textContent = `${mobileSearchFilteredCount} of ${total} results`;
      }
      mobileSearchCount.style.display = "block";
    }

    filteredResults.forEach((r) => {
      // Check if query contains any quoted phrases
      const hasQuotedPhrases = /"[^"]+"/g.test(mobileSearchQuery);

      const highlightedTitle = UI.highlightTerms(
        r.title || "",
        mobileSearchQuery,
        hasQuotedPhrases
      );
      const highlightedText = UI.highlightTerms(
        r.dialoguetext || "",
        mobileSearchQuery,
        hasQuotedPhrases
      );

      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid);
      const convoType = convo ? convo.type || "flow" : "flow";

      const div = UI.createCardItem(
        highlightedTitle,
        UI.getParsedIntOrDefault(r.conversationid),
        r.id,
        highlightedText,
        true,
        convoType
      );

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

          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
        }

        // Close mobile search and return to main view
        closeSearchScreen();
      });

      mobileSearchResults.appendChild(div);
    });

    // Update offset for next load (based on database results, not filtered)
    mobileSearchOffset += results.length;

    // Remove any existing loading indicator
    const oldLoadingIndicator = mobileSearchResults.querySelector(
      ".mobile-search-loading-indicator"
    );
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
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">Error performing search</div>';
    }
  } finally {
    isMobileLoadingMore = false;
    mobileSearchLoader.style.display = "none";
  }
}

function showMobileConvoFilter() {
  if (!mobileConvoFilterScreen) return;

  if (window.refreshMobileConvoList) {
    window.refreshMobileConvoList();
  }
  mobileConvoFilterScreen.style.display = "block";
}

function showMobileActorFilter() {
  if (!mobileActorFilterScreen) return;

  // Reset temporary selection to current selection when opening
  tempSelectedActorIds = new Set(mobileSelectedActorIds);

  // Re-render the actor list with current selection
  const listContainer = $("mobileActorFilterList");
  if (listContainer) {
    renderActorListForMobile(allActors);
  }

  mobileActorFilterScreen.style.display = "block";
}

function showMobileTypeFilter() {
  if (!mobileTypeFilterSheet) return;

  mobileTypeFilterSheet.style.display = "block";
  mobileTypeFilterSheet.classList.add("active");
}

function setupMobileConvoFilter() {
  const backBtn = $("mobileConvoFilterBack");
  const searchInput = $("mobileConvoFilterSearch");
  const listContainer = $("mobileConvoFilterList");
  const selectAllCheckbox = $("mobileConvoSelectAll");
  const addToSelectionBtn = $("mobileConvoAddToSelection");

  // Skip setup if any required elements are missing (indicates refactored HTML)
  if (!backBtn || !searchInput || !listContainer) {
    return;
  }

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
      // Trigger new search with updated filter
      if (searchInput.value.trim()) {
        performMobileSearch();
      }
    });
  }

  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered convos
        filteredConvos.forEach((c) => tempSelectedConvoIds.add(c.id));
      } else {
        // Deselect all filtered convos
        filteredConvos.forEach((c) => tempSelectedConvoIds.delete(c.id));
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
      const allSelected =
        conversations.length > 0 &&
        conversations.every((c) => tempSelectedConvoIds.has(c.id));
      const someSelected = conversations.some((c) =>
        tempSelectedConvoIds.has(c.id)
      );
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }

    // Add conversation items
    conversations.forEach((convo) => {
      const item = document.createElement("div");
      item.className = "mobile-filter-item";
      const isChecked = tempSelectedConvoIds.has(convo.id);
      item.innerHTML = `
        <input type="checkbox" ${isChecked ? "checked" : ""} />
        <span>${convo.displayTitle || `Conversation ${convo.id}`}</span>
      `;
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
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
          const allSelected = filteredConvos.every((c) =>
            tempSelectedConvoIds.has(c.id)
          );
          const someSelected = filteredConvos.some((c) =>
            tempSelectedConvoIds.has(c.id)
          );
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

  // Expose refresh function
  window.refreshMobileConvoList = () => {
    allConvos = DB.getAllConversations();

    tempSelectedConvoIds = new Set(mobileSelectedConvoIds);
    searchInput.value = "";
    renderConvoList(allConvos);
  };

  // Search filter
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderConvoList(allConvos);
      return;
    }

    const filtered = allConvos.filter((c) => {
      return (
        (c.displayTitle || "").toLowerCase().includes(query) ||
        c.id.toString().includes(query)
      );
    });

    renderConvoList(filtered);
  });
}

function updateMobileConvoFilterLabel() {
  if (!mobileConvoFilterValue) return;

  if (mobileSelectedConvoIds.size === 0) {
    mobileConvoFilterValue.textContent = "All";
  } else if (mobileSelectedConvoIds.size === 1) {
    const convoId = Array.from(mobileSelectedConvoIds)[0];
    const allConvos = DB.getAllConversations();
    const convo = allConvos.find((c) => c.id === convoId);
    mobileConvoFilterValue.textContent = convo
      ? convo.displayTitle || `#${convo.id}`
      : "1 Convo";
  } else {
    mobileConvoFilterValue.textContent = `${mobileSelectedConvoIds.size} Convos`;
  }
}

// Render mobile actor list (used by setupMobileActorFilter and showMobileActorFilter)
function renderActorListForMobile(actors) {
  const listContainer = $("mobileActorFilterList");
  const selectAllCheckbox = $("mobileActorSelectAll");

  if (!listContainer) return;

  listContainer.innerHTML = "";
  filteredActorsForMobile = actors;

  // Update Select All checkbox state
  if (selectAllCheckbox) {
    const allSelected =
      actors.length > 0 && actors.every((a) => tempSelectedActorIds.has(a.id));
    const someSelected = actors.some((a) => tempSelectedActorIds.has(a.id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = someSelected && !allSelected;
  }

  // Add actor items
  actors.forEach((actor) => {
    const item = document.createElement("div");
    item.className = "mobile-filter-item";
    const isChecked = tempSelectedActorIds.has(actor.id);
    item.innerHTML = `
      <input type="checkbox" ${isChecked ? "checked" : ""} />
      <span>${actor.name}</span>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
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
        const allSelected = filteredActorsForMobile.every((a) =>
          tempSelectedActorIds.has(a.id)
        );
        const someSelected = filteredActorsForMobile.some((a) =>
          tempSelectedActorIds.has(a.id)
        );
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
      }
    });
    listContainer.appendChild(item);
  });
}

function setupMobileActorFilter() {
  const backBtn = $("mobileActorFilterBack");
  const searchInput = $("mobileActorFilterSearch");
  const selectAllCheckbox = $("mobileActorSelectAll");
  const addToSelectionBtn = $("mobileActorAddToSelection");

  if (!backBtn || !searchInput) return;

  // Initialize temp selection
  tempSelectedActorIds = new Set(mobileSelectedActorIds);

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
      // Trigger new search with updated filter
      if (searchInput.value.trim()) {
        performMobileSearch(true);
      }
    });
  }

  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered actors
        filteredActorsForMobile.forEach((a) => tempSelectedActorIds.add(a.id));
      } else {
        // Deselect all filtered actors
        filteredActorsForMobile.forEach((a) =>
          tempSelectedActorIds.delete(a.id)
        );
      }
      renderActorListForMobile(filteredActorsForMobile);
    });
  }

  // Initial render
  renderActorListForMobile(allActors);

  // Search filter
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderActorListForMobile(allActors);
      return;
    }

    const filtered = allActors.filter((a) => {
      return (
        a.name.toLowerCase().includes(query) || a.id.toString().includes(query)
      );
    });
    renderActorListForMobile(filtered);
  });
}

function updateMobileActorFilterLabel() {
  if (!mobileActorFilterValue) return;

  if (mobileSelectedActorIds.size === 0) {
    mobileActorFilterValue.textContent = "All";
  } else if (mobileSelectedActorIds.size === 1) {
    const actorId = Array.from(mobileSelectedActorIds)[0];
    const actor = allActors.find((a) => a.id === actorId);
    mobileActorFilterValue.textContent = actor ? actor.name : "1 Actor";
  } else {
    mobileActorFilterValue.textContent = `${mobileSelectedActorIds.size} Actors`;
  }
}

function updateMobileTypeFilterLabel() {
  if (!mobileTypeFilterValue) return;

  if (mobileSelectedTypes.has("all") || mobileSelectedTypes.size === 0) {
    mobileTypeFilterValue.textContent = "All";
  } else if (mobileSelectedTypes.size === 1) {
    const type = Array.from(mobileSelectedTypes)[0];
    mobileTypeFilterValue.textContent =
      type.charAt(0).toUpperCase() + type.slice(1);
  } else {
    mobileTypeFilterValue.textContent = `${mobileSelectedTypes.size} Types`;
  }
}

function setupMobileTypeFilter() {
  // Skip setup if required elements are missing (indicates refactored HTML)
  if (!mobileTypeFilterSheet) return;

  const applyBtn = $("mobileTypeApply");
  const checkboxes = mobileTypeFilterSheet.querySelectorAll(
    'input[type="checkbox"]'
  );

  if (!applyBtn) return;

  // Close sheet when clicking outside content
  mobileTypeFilterSheet.addEventListener("click", (e) => {
    if (e.target === mobileTypeFilterSheet) {
      mobileTypeFilterSheet.style.display = "none";
      mobileTypeFilterSheet.classList.remove("active");
    }
  });

  // Handle "All" checkbox behavior
  checkboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const type = cb.dataset.type;

      if (type === "all" && cb.checked) {
        // Check all others when "All" is checked
        checkboxes.forEach((otherCb) => {
          otherCb.checked = true;
        });
      } else if (type === "all" && !cb.checked) {
        // Uncheck all others when "All" is unchecked
        checkboxes.forEach((otherCb) => {
          otherCb.checked = false;
        });
      } else if (type !== "all") {
        // If a specific type is checked/unchecked, update "All" checkbox
        const allCheckbox = mobileTypeFilterSheet.querySelector(
          'input[data-type="all"]'
        );
        const specificCheckboxes = Array.from(checkboxes).filter(
          (cb) => cb.dataset.type !== "all"
        );
        const allSpecificChecked = specificCheckboxes.every((cb) => cb.checked);
        const anySpecificChecked = specificCheckboxes.some((cb) => cb.checked);

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

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        mobileSelectedTypes.add(cb.dataset.type);
      }
    });

    // Update label
    updateMobileTypeFilterLabel();

    // Close sheet
    mobileTypeFilterSheet.style.display = "none";
    mobileTypeFilterSheet.classList.remove("active");

    // Perform search if there's a query
    if (searchInput.value.trim()) performMobileSearch();
  });
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
