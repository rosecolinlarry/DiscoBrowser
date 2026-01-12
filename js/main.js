// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import {
  getActorNameById,
  getAllConversations,
  getAlternates,
  getChecks,
  getConversationById,
  getDistinctActors,
  getEntriesBulk,
  getEntriesForConversation,
  getEntry,
  getParentsChildren,
  initDatabase,
} from "./db.js";
import {
  cacheEntry,
  clearCacheForEntry,
  getCachedEntry,
} from "./cacheEntry.js";
import { buildTitleTree, renderTree } from "./treeBuilder.js";
import {
  $,
  highlightTerms,
  renderConversationOverview,
  getStringOrDefault,
  createCardItem,
  renderCurrentEntry,
  parseSpeakerFromTitle,
  appendHistoryItem,
  renderConvoDetails,
  renderEntryDetails,
  toggleElementVisibility,
  toggleElementVisibilityBySelector,
} from "./ui.js";
import { initializeIcons, injectIconTemplates } from "./icons.js";
import {
  injectUserSettingsTemplate,
  initializeUserSettings,
  applySettings,
  openSettings,
  showHidden,
  disableColumnResizing,
  alwaysShowMoreDetails,
} from "./userSettings.js";
import {
  setupSearchInfiniteScroll,
} from "./setupSearchInfiniteScroll.js";
import {
  search,
  setCurrentSearchOffset,
  setCurrentSearchFilteredCount,
  setCurrentSearchTotal,
  hideSearchCount,
  showSearchCount,
} from "./search.js";

const actorSearchInput = $("actorSearch");
const convoCheckboxList = $("convoCheckboxList");
const actorCheckboxList = $("actorCheckboxList");
const selectAllConvos = $("selectAllConvos");
const selectAllActors = $("selectAllActors");
const actorAddToSelectionBtn = $("actorAddToSelection");
const typeFilterBtn = $("typeFilterBtn");
const typeFilterLabel = $("typeFilterLabel");
const typeFilterDropdown = $("typeFilterDropdown");
const typeCheckboxList = $("typeCheckboxList");
const selectAllTypes = $("selectAllTypes");
export const searchLoader = $("searchLoader");
const convoListEl = $("convoList");
const convoSearchInput = $("convoSearchInput");
const convoTypeFilterBtns = document.querySelectorAll(
  ".radio-button-group .radio-button"
);

export const searchInput = $("search");
export const homePageContainer = $("homePageContainer");
export const dialogueContent = $("dialogueContent");

// Mobile search state
export const entryListEl = $("entryList");
export const entryListHeaderEl = $("entryListHeader");
const entryDetailsEl = $("entryDetails");
const entryOverviewEl = $("entryOverview");
export const currentEntryContainerEl = $("currentEntryContainer");
const moreDetailsEl = $("moreDetails");

// History navigation
const chatLogEl = $("chatLog");
const backBtn = $("backBtn");
const backStatus = $("backStatus");
const convoRootBtn = $("convoRootBtn");

// Sidebar elements
const sidebarOverlay = $("sidebarOverlay");

const convoSection = $("convoSection");
const historySection = $("historySection");

const browserEl = $("browser");

const historySidebarToggle = $("historySidebarToggle");
const historySidebar = $("historySidebar");
const historySidebarClose = $("historySidebarClose");

const convoSidebarToggle = $("convoSidebarToggle");
const convoSidebar = $("convoSidebar");
const convoSidebarClose = $("convoSidebarClose");

// Mobile elements
// Use the single search input for both desktop and mobile to keep state unified
export const mobileSearchTrigger = $("mobileSearchTrigger");
const mobileSearchInputWrapper = $("mobileSearchInputWrapper");
// The actual mobile header trigger element (readonly input)
const mobileSearchTriggerEl = mobileSearchTrigger;
export const mobileSearchScreen = $("mobileSearchScreen");
export const mobileSearchResults = $("mobileSearchResults");
export const mobileSearchCount = $("mobileSearchCount");
const mobileClearFilters = $("mobileClearFilters");

const mobileSidebarToggle = $("mobileSidebarToggle");

const mobileSearchBack = $("mobileSearchBack");

// Mobile nav menu buttons
const mobileNavPanel = $("mobileNavPanel");
const mobileNavSidebarClose = $("navSidebarClose");
const mobileNavBtn = $("mobileNavBtn");
const mobileNavHome = $("mobileNavHome");
const mobileNavSettings = $("mobileNavSettings");
const mobileNavSearch = $("mobileNavSearch");

// Tree control elements
const expandAllBtn = $("expandAllBtn");
const collapseAllBtn = $("collapseAllBtn");

// Filter dropdowns

const convoFilterDropdownWrapper = $("convoFilterWrapper"); // Filter Wrapper
const mobileConvoFilter = $("mobileConvoFilter"); // Button
const convoFilterDropdown = $("convoFilterDropdown"); // Checklist
const mobileConvoFilterWrapper = $("mobileConvoFilterWrapper"); // Checklist

const convoFilterLabelWrapper = $("convoFilterLabelWrapper"); // Text Wrapper
const mobileConvoFilterLabelWrapper = $("mobileConvoFilterLabelWrapper"); // Text Wrapper
const convoFilterLabel = $("convoFilterLabel"); // Text

const actorFilterWrapper = $("actorFilterWrapper"); // Filter Wrapper
const mobileActorFilter = $("mobileActorFilter"); // Button
const actorFilterDropdown = $("actorFilterDropdown"); // Checklist
const mobileActorFilterWrapper = $("mobileActorFilterWrapper"); // Checklist

const actorFilterLabelWrapper = $("actorFilterLabelWrapper"); // Text Wrapper
const mobileActorFilterLabelWrapper = $("mobileActorFilterLabelWrapper"); // Test Wrapper
const actorFilterLabel = $("actorFilterLabel"); // Text

const mobileTypeFilter = $("mobileTypeFilter"); // Button
const mobileTypeFilterWrapper = $("mobileTypeFilterWrapper"); // Filter Wrapper
const mobileTypeFilterSheet = $("mobileTypeFilterSheet"); // Checklist

// Search Bar
const searchBtn = $("searchBtn");
const searchClearBtn = $("searchClearBtn");

// Clear filters button
const clearFiltersBtn = $("clearFiltersBtn");

export const searchResultLimit = 50;

export let navigationHistory = [];
export let currentConvoId = null;
let currentEntryId = null;
let currentAlternateCondition = null;
let currentAlternateLine = null;
let conversationTree = null;
let activeTypeFilter = "all";
export let allConvos = [];
export let allActors = [];
export let selectedConvoIds = new Set();
export let selectedActorIds = new Set();
export let selectedTypeIds = new Set(["flow", "orb", "task"]); // All types selected by default
let filteredActors = [];

// Browser history state tracking
let currentAppState = "home"; // 'home', 'conversation', 'search'
export let isHandlingPopState = false;

// Browser Grid
const browserGrid = $("browser");

export const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
export const tabletMediaQuery = window.matchMedia(
  "(min-width: 769px) and (max-width: 1024px)"
);
export const desktopMediaQuery = window.matchMedia("(min-width: 1025px)");

export const defaultColumns = "352px 1fr 280px";
export const STORAGE_KEY = "discobrowser_grid_columns";

// Inject templates as soon as the module loads
injectUserSettingsTemplate();
injectIconTemplates();

export function setCurrentConvoId(value) {
  currentConvoId = value;
}

export function getConversationsForTree() {
  allConvos = getAllConversations(showHidden());
  return allConvos.map((c) => ({
    ...c,
    title: c.title,
  }));
}

export function rebuildConversationTree() {
  // Rebuild tree to reflect hidden/title settings
  const convos = getConversationsForTree();
  conversationTree = buildTitleTree(convos);
  renderTree(convoListEl, conversationTree);
  if (currentConvoId !== null) {
    highlightConversationInTree(currentConvoId);
  }
}

function setupMobileNavMenu() {
  mobileNavHome.addEventListener("click", goBackHomeWithBrowserHistory);
  mobileNavSettings.addEventListener("click", openSettings);
  mobileNavSearch.addEventListener("click", openMobileSearchScreen);
}

export function updateResizeHandles() {
  const leftHandle = document.querySelector(".resize-handle-left");
  const rightHandle = document.querySelector(".resize-handle-right");

  if (
    disableColumnResizing() ||
    mobileMediaQuery.matches ||
    tabletMediaQuery.matches
  ) {
    if (leftHandle) leftHandle.classList.add("disabled");
    if (rightHandle) rightHandle.classList.add("disabled");
  } else {
    if (leftHandle) leftHandle.classList.remove("disabled");
    if (rightHandle) rightHandle.classList.remove("disabled");
  }
}

export function updateHandlePositions() {
  const browserGrid = $("browser");
  const columns = (browserGrid.style.gridTemplateColumns || defaultColumns)
    .split(" ")
    .map((s) => s.trim());
  const col1 = columns[0];
  const col3 = columns[2];
  browserGrid.style.setProperty("--handle-left-pos", `calc(${col1} - 4px)`);
  browserGrid.style.setProperty("--handle-right-pos", `calc(${col3} - 4px)`);
}

function setUpMediaQueries() {
  desktopMediaQuery.addEventListener("change", handleMediaQueryChange);
  tabletMediaQuery.addEventListener("change", handleMediaQueryChange);
  mobileMediaQuery.addEventListener("change", handleMediaQueryChange);
  handleMediaQueryChange();
}

function setUpConvoListEvents() {
  if (!convoListEl) return;
  // event delegation: clicks in convoList
  convoListEl.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-convo-id]");
    if (target) {
      const convoId = target.dataset.convoId;
      await loadEntriesForConversation(convoId, true);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const convoId = topLabel.dataset.singleConvo;
      await loadEntriesForConversation(convoId, true);
    }
  });

  // Handle custom convoLeafClick events from tree builder
  convoListEl.addEventListener("convoLeafClick", async (e) => {
    const convoId = e.detail.convoId;
    await loadEntriesForConversation(convoId, true);
    highlightConversationInTree(convoId);
  });
}

function setUpChatLogEvents() {
  if (!chatLogEl) return;
  chatLogEl.addEventListener("navigateToConversation", async (e) => {
    const convoId = e.detail.convoId;
    await loadEntriesForConversation(convoId, true);
    highlightConversationInTree(convoId);
  });
}

function updateResizableGrid() {
  if (!browserGrid || !desktopMediaQuery.matches) {
    browserGrid.style.removeProperty("gridTemplateColumns");
  } else {
    initializeResizableGrid();
  }
}

function applySavedColumns(savedColumns) {
  if (savedColumns) {
    try {
      const columns = JSON.parse(savedColumns);
      browserGrid.style.gridTemplateColumns = columns.join(" ");
    } catch (e) {
      console.error("Failed to restore grid columns", e);
      browserGrid.style.gridTemplateColumns = defaultColumns;
    }
  } else {
    // Set default columns on first load / hard refresh
    browserGrid.style.gridTemplateColumns = defaultColumns;
  }
}

function initializeResizableGrid() {
  if (!browserGrid || !desktopMediaQuery.matches) return;

  const convoSection = browserGrid.querySelector(".convo-section");
  const entriesSection = browserGrid.querySelector(".entries-section");
  const historySection = browserGrid.children[2];

  if (!convoSection || !entriesSection || !historySection) return;

  // Store grid column widths in local storage
  const savedColumns = localStorage.getItem(STORAGE_KEY);

  applySavedColumns(savedColumns);

  // Create resize handles
  const leftHandle = document.createElement("div");
  leftHandle.className = "resize-handle resize-handle-left";
  leftHandle.title = "Drag to resize sections";

  const rightHandle = document.createElement("div");
  rightHandle.className = "resize-handle resize-handle-right";
  rightHandle.title = "Drag to resize sections";

  // Append handles to grid
  browserGrid.appendChild(leftHandle);
  browserGrid.appendChild(rightHandle);

  // Helper function to update handle positions
  function updateHandlePositions() {
    const columns = (browserGrid.style.gridTemplateColumns || defaultColumns)
      .split(" ")
      .map((s) => s.trim());
    const col1 = columns[0];
    const col3 = columns[2];
    browserGrid.style.setProperty("--handle-left-pos", `calc(${col1} - 4px)`);
    browserGrid.style.setProperty("--handle-right-pos", `calc(${col3} - 4px)`);
  }

  // Initialize handle positions
  updateHandlePositions();

  // Apply disabled state if column resizing is disabled
  if (disableColumnResizing()) {
    leftHandle.classList.add("disabled");
    rightHandle.classList.add("disabled");
  }

  setUpResizeHandleLeft(leftHandle);
  setUpResizeHandleRight(rightHandle);
}

function setUpResizeHandleLeft(leftHandle) {
  // Left handle: resize convo and entries sections
  leftHandle.addEventListener("mousedown", (e) => {
    if (disableColumnResizing()) return;
    e.preventDefault();
    const startX = e.clientX;
    const startColumns = (
      browserGrid.style.gridTemplateColumns || defaultColumns
    )
      .split(" ")
      .map((s) => s.trim());
    const initialCol1 = parseFloat(startColumns[0]);

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const col1 = Math.max(200, Math.min(500, initialCol1 + deltaX));
      const newColumns = `${col1}px 1fr ${startColumns[2]}`;
      browserGrid.style.gridTemplateColumns = newColumns;
      updateHandlePositions();
    }

    function handleMouseUp() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      const currentColumns = browserGrid.style.gridTemplateColumns;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(currentColumns.split(" ").map((s) => s.trim()))
      );
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
}

function setUpResizeHandleRight(rightHandle) {
  // Right handle: resize entries and history sections
  rightHandle.addEventListener("mousedown", (e) => {
    if (disableColumnResizing()) return;
    e.preventDefault();
    const startX = e.clientX;
    const startColumns = (
      browserGrid.style.gridTemplateColumns || defaultColumns
    )
      .split(" ")
      .map((s) => s.trim());
    const initialCol3 = parseFloat(startColumns[2]);

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const col3 = Math.max(200, Math.min(500, initialCol3 - deltaX));
      const newColumns = `${startColumns[0]} 1fr ${col3}px`;
      browserGrid.style.gridTemplateColumns = newColumns;
      updateHandlePositions();
    }

    function handleMouseUp() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      const currentColumns = browserGrid.style.gridTemplateColumns;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(currentColumns.split(" ").map((s) => s.trim()))
      );
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
}

function handleMediaQueryChange() {
  closeAllSidebars();
  closeMobileSearchScreen();
  closeAllModals();
  if (desktopMediaQuery.matches) {
    toggleElementVisibilityBySelector("#historySidebarToggle", false);
    toggleElementVisibilityBySelector("#convoSidebarToggle", false);
    toggleElementVisibilityBySelector(".mobile-container", false);
    browserEl?.prepend(convoSection);
    browserEl?.appendChild(historySection);
  } else if (tabletMediaQuery.matches) {
    toggleElementVisibilityBySelector("#historySidebarToggle", true);
    toggleElementVisibilityBySelector("#convoSidebarToggle", true);
    toggleElementVisibilityBySelector(".mobile-container", false);
    updateResizableGrid();
    historySidebar?.appendChild(historySection);
    convoSidebar?.appendChild(convoSection);
  } else if (mobileMediaQuery.matches) {
    toggleElementVisibilityBySelector("#historySidebarToggle", true);
    toggleElementVisibilityBySelector("#convoSidebarToggle", false);
    toggleElementVisibilityBySelector(".mobile-container", true);
    updateResizableGrid();
    historySidebar?.append(historySection);
    convoSidebar?.appendChild(convoSection);
  }
  moveTypeFilterDropdown();
  moveConvoFilterDropdown();
  moveActorFilterDropdown();
  moveWholeWordsButton();
  moveClearFiltersBtn();
  moveSearchLoader();
  moveSearchInput();
  applySettings();
}

function moveWholeWordsButton() {
  const el = $("wholeWordsButton");
  const elWrapper = $("wholeWordsButtonWrapper");
  const mobileElWrapper = $("mobileWholeWordsButtonWrapper");
  if (mobileMediaQuery.matches) {
    mobileElWrapper.appendChild(el);
  } else {
    elWrapper.appendChild(el);
  }
}
function moveClearFiltersBtn() {
  const el = $("clearFiltersBtn");
  const elWrapper = $("clearFiltersBtnWrapper");
  const mobileElWrapper = $("mobileClearFiltersBtnWrapper");
  if (mobileMediaQuery.matches) {
    mobileElWrapper.appendChild(el);
  } else {
    elWrapper.appendChild(el);
  }
}
function moveSearchLoader() {
  const el = $("searchLoader");
  const elWrapper = $("searchLoaderWrapper");
  const mobileElWrapper = $("mobileSearchLoaderWrapper");
  if (mobileMediaQuery.matches) {
    mobileElWrapper.appendChild(el);
  } else {
    elWrapper.appendChild(el);
  }
}
function moveSearchInput() {
  const el = $("search");
  const elWrapper = $("searchInputWrapper");
  const mobileElWrapper =mobileSearchInputWrapper;
  const clearButtonElWrapper = document.querySelector(".clear-icon-btn-wrapper.desktop")
  const mobileClearButtonElWrapper = document.querySelector(".clear-icon-btn-wrapper.mobile")
  const searchButtonElWrapper = document.querySelector(".search-icon-btn-wrapper.desktop")
  const mobileSearchButtonElWrapper = document.querySelector(".search-icon-btn-wrapper.mobile")
  if (mobileMediaQuery.matches) {
    mobileElWrapper.appendChild(el);
    mobileClearButtonElWrapper.appendChild(searchClearBtn)
    mobileSearchButtonElWrapper.appendChild(searchBtn)
  } else {
    elWrapper.appendChild(el);
    clearButtonElWrapper.appendChild(searchClearBtn)
    searchButtonElWrapper.appendChild(searchBtn)
  }
}

function moveConvoFilterDropdown() {
  if (mobileMediaQuery.matches) {
    mobileConvoFilterWrapper.appendChild(convoFilterDropdown);
    mobileConvoFilterLabelWrapper.appendChild(convoFilterLabel);
    mobileConvoFilter.addEventListener("click", showMobileConvoFilter);
  } else {
    convoFilterDropdownWrapper.appendChild(convoFilterDropdown);
    convoFilterLabelWrapper.appendChild(convoFilterLabel);
  }
}
function moveActorFilterDropdown() {
  if (!actorFilterDropdown) {
    populateActorDropdown();
    return;
  }
  if (mobileMediaQuery.matches) {
    mobileActorFilterWrapper.appendChild(actorFilterDropdown);
    mobileActorFilterLabelWrapper.appendChild(actorFilterLabel);
    mobileActorFilter.addEventListener("click", showMobileActorFilter);
  } else {
    actorFilterWrapper.appendChild(actorFilterDropdown);
    actorFilterLabelWrapper.appendChild(actorFilterLabel);
  }
}
function moveTypeFilterDropdown() {
  const el = $("typeFilterDropdown");
  const elWrapper = $("typeFilterWrapper");
  const mobileElWrapper = $("mobileTypeFilterWrapper");

  const elLabel = $("typeFilterLabel");
  const elLabelWrapper = $("typeFilterDropdownLabelWrapper");
  const mobileElLabelWrapper = $("mobileTypeFilterWrapperLabel");

  if (mobileMediaQuery.matches) {
    mobileElWrapper.appendChild(el);
    mobileElLabelWrapper.appendChild(elLabel);
    mobileTypeFilter.addEventListener("click", showMobileTypeFilter);
  } else {
    elWrapper.appendChild(el);
    elLabelWrapper.appendChild(elLabel);
  }
}

function setUpSidebarToggles() {
  convoSidebarToggle.addEventListener("click", openConversationSection);
  historySidebarToggle.addEventListener("click", openHistorySidebar);
  mobileNavBtn.addEventListener("click", openMobileNavSidebar);
  sidebarOverlay.addEventListener("click", closeAllSidebars);
  sidebarOverlay.addEventListener("click", closeAllModals);
}
function setupConversationFilter() {
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
function updateTreeControlButtons(enableButtons) {
  if (expandAllBtn) {
    expandAllBtn.disabled = !enableButtons;
  }
  if (collapseAllBtn) {
    collapseAllBtn.disabled = !enableButtons;
  }
}
function setToggleIcon(toggleEl, expanded) {
  if (!toggleEl) return;

  // Only update toggles that are meant to expand/collapse
  if (toggleEl.dataset && toggleEl.dataset.canToggle === "false") return;

  const templateId = "icon-chevron-right-template";
  const template = $(templateId);

  const clone = template.content.cloneNode(true);
  const svg = clone.querySelector("svg");
  if (svg) {
    svg.setAttribute("width", "18px");
    svg.setAttribute("height", "18px");
  }

  toggleEl.innerHTML = "";
  toggleEl.appendChild(clone);

  // Update rotation class for animation
  toggleEl.classList.toggle("toggle-expanded", expanded);
}
function expandAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    const toggle = node.querySelector(".toggle");
    if (
      toggle &&
      toggle.dataset.canToggle === "true" &&
      !node.classList.contains("expanded")
    ) {
      node.classList.add("expanded");
      setToggleIcon(toggle, true);
    }
  });
}
function collapseAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    if (node.classList.contains("expanded")) {
      const toggle = node.querySelector(".toggle");
      node.classList.remove("expanded");
      if (toggle && toggle.dataset.canToggle === "true") {
        setToggleIcon(toggle, false);
      }
    }
  });
}
function filterConversationTree() {
  let searchText;
  if (!conversationTree) return;
  searchText = convoSearchInput?.value?.toLowerCase().trim() ?? "";
  // If no text search is active
  if (!searchText) {
    // Show full tree when all types selected
    if (activeTypeFilter === "all") {
      renderTree(convoListEl, conversationTree);
      updateTreeControlButtons(true);
      if (currentConvoId !== null) {
        highlightConversationInTree(currentConvoId);
      }
      return;
    }

    // Build a filtered tree for the selected type
    const { convoTitleById, convoTypeById } = conversationTree;
    const filteredRows = Object.keys(convoTitleById)
      .map((idStr) => {
        const id = Number(idStr);
        return {
          id,
          title: convoTitleById[id],
          type: convoTypeById[id] || "flow",
        };
      })
      .filter((row) => row.type === activeTypeFilter);

    if (filteredRows.length === 0) {
      convoListEl.innerHTML = "(no conversations for selected type)";
      updateTreeControlButtons(false);
      return;
    }

    const filteredTree = buildTitleTree(filteredRows);
    renderTree(convoListEl, filteredTree);
    updateTreeControlButtons(true);
    if (currentConvoId !== null) {
      highlightConversationInTree(currentConvoId);
    }
    return;
  }

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
  updateTreeControlButtons(false);

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
      const convo = getConversationById(cid);
      if (!convo) return;

      // Type filter
      if (typeFilter !== "all" && convo.type !== typeFilter) {
        return;
      }

      // Text filter
      if (searchText) {
        const titleMatch = convo.title.toLowerCase().includes(searchText);
        const idMatch = cid.toString().includes(searchText);
        if (titleMatch || idMatch) {
          matches.push({
            convoId: cid,
            title: convo.title,
            type: convo.type || "flow",
          });
        }
      } else {
        matches.push({
          convoId: cid,
          title: convo.title,
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

  // Highlight matching text (supports quoted phrases and multi-word queries)
  if (searchText) {
    const hasQuotedPhrases = /"[^"]+"/g.test(searchText);
    titleSpan.innerHTML = highlightTerms(
      match?.title || "",
      searchText,
      hasQuotedPhrases
    );
  } else {
    titleSpan.textContent = match?.title;
  }

  // Append convo ID without overwriting HTML
  const titleText = titleSpan.textContent || match?.title || "";
  if (!titleText.endsWith(` #${label.dataset.convoId}`)) {
    const idNode = document.createTextNode(` #${label.dataset.convoId}`);
    titleSpan.appendChild(idNode);
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
async function handleMoreDetailsClicked() {
  if (moreDetailsEl.open) {
    if (currentConvoId && currentEntryId) {
      await showEntryDetails(
        currentConvoId,
        currentEntryId,
        currentAlternateCondition,
        currentAlternateLine
      );
    } else if (currentConvoId) {
      await showConvoDetails(currentConvoId);
    }
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
}

function setUpFilterDropdowns() {
  const dropdownButtons = document.querySelectorAll(".filter-dropdown-button");
  const allDropdowns = document.querySelectorAll(".filter-dropdown");

  // Prevent clicks inside any dropdown from bubbling to document
  allDropdowns.forEach((dd) =>
    dd.addEventListener("click", (ev) => ev.stopPropagation())
  );

  // Track currently open dropdown so we only allow one at a time
  let openDropdown = null;

  // Single document-level click handler to close the open dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!openDropdown) return;
    if (!openDropdown.contains(e.target) && e.target !== typeFilterBtn) {
      toggleElementVisibility(openDropdown, false);
      openDropdown = null;
    }
  });

  dropdownButtons.forEach((dropdownButton) => {
    dropdownButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const filterDropdown =
        dropdownButton.parentElement?.querySelector(".filter-dropdown");
      if (!filterDropdown) return;

      const shouldOpen = filterDropdown.classList.contains("hidden");

      // Close any other open dropdown first
      if (openDropdown && openDropdown !== filterDropdown) {
        toggleElementVisibility(openDropdown, false);
      }

      // Toggle the clicked dropdown
      toggleElementVisibility(filterDropdown, shouldOpen);

      // Update currently open reference
      openDropdown = shouldOpen ? filterDropdown : null;
    });
  });
}
// #region Filter Dropdowns

// #region Conversation Filter Dropdown
function setupConvoFilter() {
  const convoFilterSearch = $("convoSearch");
  const listContainer = $("convoCheckboxList");
  const selectAllCheckbox = $("selectAllConvos");
  const addToSelectionBtn = $("convoAddToSelection");

  let filteredConvos = [];

  // Add to Selection button - apply changes
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener("click", () => {
      selectedConvoIds = new Set(selectedConvoIds);
      updateConvoFilterLabel();
      toggleElementVisibility(mobileConvoFilterWrapper, false);

      // Trigger new search with updated filter
      if (convoFilterSearch.value.trim()) {
        search();
      }
    });
  }

  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered convos
        filteredConvos.forEach((c) => selectedConvoIds.add(c.id));
      } else {
        // Deselect all filtered convos
        filteredConvos.forEach((c) => selectedConvoIds.delete(c.id));
      }
      renderConvoList(filteredConvos);
    });
  }

  // Render conversation list
  function renderConvoList(conversations) {
    listContainer.innerHTML = "";
    filteredConvos = conversations;

    // Add conversation items
    conversations.forEach((convo) => {
      const label = document.createElement("label");
      label.className = "checkbox-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.convoId = convo.id;
      checkbox.dataset.convoTitle = convo.title;
      checkbox.checked = selectedConvoIds.has(convo.id);

      checkbox.addEventListener("change", (e) => {
        if (checkbox.checked) {
          selectedConvoIds.add(convo.id);
        } else {
          selectedConvoIds.delete(convo.id);
        }

        updateConvoSelectAllState(conversations);
        updateConvoFilterLabel();
        triggerSearch(e);
      });
      const span = document.createElement("span");
      span.textContent = convo.title;

      label.appendChild(checkbox);
      label.appendChild(span);
      convoCheckboxList.appendChild(label);
    });
  }

  // Initial render
  if (!allConvos || allConvos.length === 0) {
    allConvos = getConversationsForTree();
  }
  renderConvoList(allConvos);

  // Search filter
  convoFilterSearch.addEventListener("input", () => {
    const query = convoFilterSearch.value.toLowerCase().trim();
    if (!query) {
      renderConvoList(allConvos);
      return;
    }

    const filtered = allConvos.filter((c) => {
      return (
        (c.title || "").toLowerCase().includes(query) ||
        c.id.toString().includes(query)
      );
    });

    renderConvoList(filtered);
  });

  function updateConvoSelectAllState(conversations) {
    if (selectAllCheckbox) {
      const allSelected =
        conversations.length > 0 &&
        conversations.every((c) => selectedConvoIds.has(c.id));
      const someSelected = conversations.some((c) =>
        selectedConvoIds.has(c.id)
      );
      selectAllCheckbox.checked = allSelected;
      selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
  }
}
function updateConvoFilterLabel() {
  if (
    selectedConvoIds.size === 0 ||
    selectedConvoIds.size === allConvos.length
  ) {
    convoFilterLabel.textContent = "All Conversations";
  } else if (selectedConvoIds.size === 1) {
    const convoId = Array.from(selectedConvoIds)[0];
    const convo = allConvos.find((c) => c.id === convoId);
    convoFilterLabel.textContent = convo ? convo.title : "1 Conversation";
  } else {
    convoFilterLabel.textContent = `${selectedConvoIds.size} Conversations`;
  }
}

// #endregion

// #region Actor Filter Dropdown
async function populateActorDropdown() {
  allActors = getDistinctActors();
  filteredActors = [...allActors];

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
      triggerSearch(e);
    });
  }

  // Add to Selection button
  if (actorAddToSelectionBtn) {
    actorAddToSelectionBtn.addEventListener("click", (e) => {
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

      // Close mobile actor filter screen and remove dropdown show state
      toggleElementVisibility(mobileActorFilterWrapper, false);
      toggleElementVisibility(actorFilterDropdown, false);

      // Trigger a reset search so results reflect the new selection
      search(true);
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
  updateActorSelectAllState();
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

    checkbox.addEventListener("change", (e) => {
      if (checkbox.checked) {
        selectedActorIds.add(actor.id);
      } else {
        selectedActorIds.delete(actor.id);
      }
      updateActorSelectAllState();
      updateActorFilterLabel();
      triggerSearch(e);
    });

    const span = document.createElement("span");
    span.textContent = actor.name;

    label.appendChild(checkbox);
    label.appendChild(span);
    actorCheckboxList.appendChild(label);
  });

  updateActorSelectAllState();
}
function updateActorSelectAllState() {
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
// #endregion

// #region Conversation Type Filter Dropdown
// Setup type filter
function setupTypeFilter() {
  // Select All checkbox
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
    triggerSearch(e);
  });

  // Individual type checkboxes
  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]'
  );
  typeCheckboxes.forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const type = cb.dataset.type;

      if (cb.checked) {
        selectedTypeIds.add(type);
      } else {
        selectedTypeIds.delete(type);
      }

      updateTypeSelectAllState();
      updateTypeFilterLabel();
      triggerSearch(e);
    });
  });

  updateTypeFilterLabel();
}

function updateTypeSelectAllState() {
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
  if (selectedTypeIds.size === 0 || selectedTypeIds.size === 3) {
    typeFilterLabel.textContent = "All Types";
  } else if (selectedTypeIds.size === 1) {
    const type = Array.from(selectedTypeIds)[0];
    typeFilterLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  } else {
    typeFilterLabel.textContent = `${selectedTypeIds.size} Types`;
  }
}

// #endregion

// #endregion

function triggerSearch(e) {
  e.preventDefault();

  if (searchInput.value) {
    // Always reset search when filters change to clear old results
    // But only push history state if not already in search view
    const isAlreadySearching = currentAppState === "search";
    if (isAlreadySearching) {
      // Already in search view, manually reset and search without pushing history
      setCurrentSearchOffset(0);
      setCurrentSearchFilteredCount(0);
      entryListEl.innerHTML = "";
      // Prevent pushHistoryState by temporarily marking as handling popstate
      const prevPop = isHandlingPopState;
      isHandlingPopState = true;
      try {
        search(true);
      } finally {
        isHandlingPopState = prevPop;
      }
    } else {
      // First time searching, push history state
      search(true);
    }
  }
}

// #region Sidebars
// #region History Sidebar
function openHistorySidebar() {
  toggleElementVisibility(historySidebar, true);
  closeConversationSection();
  historySidebarClose.addEventListener("click", closeHistorySidebar);
}
function closeHistorySidebar() {
  toggleElementVisibility(historySidebar, false);
  toggleElementVisibility(sidebarOverlay, false);
}
// #endregion

// #region Conversation Tree Sidebar
function closeConversationSection() {
  toggleElementVisibility(convoSidebar, false);
  toggleElementVisibility(sidebarOverlay, false);
}
function openConversationSection() {
  closeHistorySidebar();
  toggleElementVisibility(convoSidebar, true);
  convoSidebarClose.addEventListener("click", closeConversationSection);
  toggleElementVisibility(sidebarOverlay, true);
}
// #endregion
// #endregion

export function closeMobileSearchScreen() {
  toggleElementVisibility(mobileSearchScreen, false);
  mobileSearchInputWrapper.classList.remove("expanded");
}

// Setup clear filters button
function setupClearFiltersBtn() {
  if (!clearFiltersBtn) return;

  clearFiltersBtn.addEventListener("click", (e) => {
    // Reset convo filters
    selectedConvoIds.clear();
    const convoCheckboxes = convoCheckboxList?.querySelectorAll(
      'input[type="checkbox"]'
    );
    convoCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
    selectAllConvos.checked = true;
    selectAllConvos.indeterminate = false;
    updateConvoFilterLabel();

    // Reset actor filters
    selectedActorIds.clear();
    const actorCheckboxes = actorCheckboxList?.querySelectorAll(
      'input[type="checkbox"]'
    );
    actorCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
    selectAllActors.checked = true;
    selectAllActors.indeterminate = false;
    updateActorFilterLabel();

    // Reset type filters - select all
    selectedTypeIds.clear();
    selectedTypeIds.add("flow");
    selectedTypeIds.add("orb");
    selectedTypeIds.add("task");

    const typeCheckboxes = typeCheckboxList?.querySelectorAll(
      'input[type="checkbox"][data-type]'
    );
    typeCheckboxes.forEach((cb) => {
      cb.checked = true;
    });
    selectAllTypes.checked = true;
    selectAllTypes.indeterminate = false;
    updateTypeFilterLabel();

    // Reset whole words checkbox
    const wholeWordsCheckbox = $("wholeWordsCheckbox");
    wholeWordsCheckbox.checked = false;

    // Trigger search with cleared filters
    triggerSearch(e);
  });
}

// Expand and highlight conversation in the conversation tree
export function highlightConversationInTree(convoId) {
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
      if (toggle) {
        setToggleIcon(toggle, true);
      }

      // Move up one level
      node = node.parentElement?.closest(".node");
    }
  }
}

/* Load entries listing for conversation */
async function loadEntriesForConversation(convoId, resetHistory = false) {

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
  } else if (resetHistory) {
    navigationHistory = [{ convoId, entryId: null }];
  }

  toggleElementVisibility(currentEntryContainerEl, true);

  // Hide homepage, show dialogue content
  toggleElementVisibility(homePageContainer, false);
  toggleElementVisibility(dialogueContent, true);

  // Remove search mode styling
  const entryListContainer = entryListEl?.closest(".entry-list");
  if (entryListContainer) entryListContainer.classList.remove("full-height");

  // Reset search state to prevent infinite scroll from loading more search results
  setCurrentSearchOffset(0);
  setCurrentSearchTotal(0);
  setCurrentSearchFilteredCount(0);

  // Update current state for conversation root
  currentConvoId = convoId;
  currentEntryId = null;

  // Disable root button at conversation root
  if (convoRootBtn) {
    convoRootBtn.disabled = true;
  }

  // Update mobile nav buttons (at root, so hide both)
  updateMobileNavButtons();

  // Show conversation metadata instead of entry details
  const conversation = getConversationById(convoId);
  if (conversation) {
    renderConversationOverview(entryOverviewEl, conversation);
  }

  // Make sure current entry container is visible
  toggleElementVisibility(currentEntryContainerEl, true);

  // Auto-open More Details if setting enabled
  if (moreDetailsEl && alwaysShowMoreDetails()) {
    moreDetailsEl.open = true;
    toggleElementVisibility(moreDetailsEl, true);
  }

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    if (convoId) {
      await showConvoDetails(convoId);
    }
  }

  // Check conversation type - orbs and tasks often don't have meaningful entries
  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";

  // For flows, remove compact class and expanded class
  entryListEl.classList.remove("compact");
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove("expanded");
  }

  const rows = getEntriesForConversation(convoId, showHidden());
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
    const entryId = r.id;
    const title = getStringOrDefault(r.title, "(no title)");

    const text = r.dialoguetext || "";
    const el = createCardItem(title, convoId, entryId, text);
    el.addEventListener("click", () => navigateToEntry(convoId, entryId));
    entryListEl.appendChild(el);
  });
}

// #region Navigation and History Management

// #region Browser History Management
function goBackHomeWithBrowserHistory() {
  // Use browser history to go back to home
  if (currentConvoId !== null || currentAppState !== "home") {
    window.history.pushState({ view: "home" }, "", window.location.pathname);
    goToHomeView();
  }
}

function updateBackButtonState() {
  if (!backBtn) return;
  backBtn.disabled = navigationHistory.length <= 1;
  if (backStatus) {
    if (navigationHistory.length > 1) {
      backStatus.textContent = `(${navigationHistory.length - 1} step${
        navigationHistory.length - 1 !== 1 ? "s" : ""
      })`;
    } else {
      backStatus.textContent = "(none)";
    }
  }
}

async function setupBrowserHistory() {
  // Set initial state
  window.history.replaceState({ view: "home" }, "", window.location.pathname);
  currentAppState = "home";

  // Handle browser back/forward buttons
  window.addEventListener("popstate", async (event) => {
    if (isHandlingPopState) return;
    isHandlingPopState = true;

    const state = event.state;

    // Always close mobile search screen if it's open (when navigating via back button)
    closeMobileSearchScreen();

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

        await loadEntriesForConversation(state.convoId, false);
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

export function pushHistoryState(view, data = {}) {
  if (isHandlingPopState) return;

  const state = { view, ...data };
  currentAppState = view;
  window.history.pushState(state, "", window.location.pathname);
}

export function setNavigationHistory(value) {
  navigationHistory = value;
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
    const cid = target.convoId;
    const eid = target.entryId;

    // Update current state
    currentConvoId = cid;
    currentEntryId = eid;

    // Update the UI
    const coreRow = getEntry(currentConvoId, currentEntryId);
    const title = coreRow?.title;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";

    // Get conversation type
    const conversation = getConversationById(currentConvoId);
    const convoType = conversation?.type || "flow";

    renderCurrentEntry(
      entryOverviewEl,
      cid,
      eid,
      title,
      dialoguetext,
      convoType
    );

    // Add current entry to history log (non-clickable)
    if (chatLogEl) {
      const currentTitle = parseSpeakerFromTitle(title) || "(no title)";
      appendHistoryItem(
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
      if (currentConvoId && currentEntryId) {
        await showEntryDetails(currentConvoId, currentEntryId);
      } else if (currentConvoId && !currentEntryId) {
        await showConvoDetails(currentConvoId);
      }
    }
  }

  updateBackButtonState();
}
// #endregion

function goToHomeView() {
  // Clear current conversation
  currentConvoId = null;
  currentEntryId = null;
  navigationHistory = [];

  // Clear chat log
  if (chatLogEl) {
    chatLogEl.innerHTML = "";
  }

  // Show homepage, hide dialogue content
  toggleElementVisibility(homePageContainer, true);
  toggleElementVisibility(dialogueContent, false);

  // Reset entry list header
  if (entryListHeaderEl) {
    entryListHeaderEl.textContent = "Next Dialogue Options";
  }

  // Clear tree selection
  document.querySelectorAll(".tree-item.selected").forEach((item) => {
    item.classList.remove("selected");
  });

  // Disable mobile back button if visible
  if (backBtn) {
    backBtn.disabled = true;
  }

  // Close mobile search if open
  closeMobileSearchScreen();

  updateBackButtonState();
}

/* Jump to conversation root */
export async function jumpToConversationRoot() {
  if (currentConvoId === null) return;

  // Clear all entries except the first one (conversation root)
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll(".card-item");
    historyItems.forEach((item) => item.remove());
  }

  // Reset to just the conversation root
  navigationHistory = [{ convoId: currentConvoId, entryId: null }];

  // Load the conversation root
  await loadEntriesForConversation(currentConvoId, false);
  highlightConversationInTree(currentConvoId);
  updateBackButtonState();
}

/* navigateToEntry simplified */
export async function navigateToEntry(
  convoId,
  entryId,
  addToHistory = true,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  hideSearchCount();
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
  toggleElementVisibility(homePageContainer, false);
  toggleElementVisibility(dialogueContent, true);
  // Make visible
  toggleElementVisibility(currentEntryContainerEl, true);

  // Auto-open More Details if setting enabled
  if (moreDetailsEl && alwaysShowMoreDetails()) {
    moreDetailsEl.open = true;
    toggleElementVisibility(moreDetailsEl, true);
  }

  // Also restore entry list layout when navigating from search
  const entryListContainer = entryListEl?.closest(".entry-list");
  if (entryListContainer) {
    entryListContainer.classList.remove("full-height");
  }

  // Reset search state to prevent infinite scroll from loading more search results
  setCurrentSearchOffset(0);
  setCurrentSearchTotal(0);
  setCurrentSearchFilteredCount(0);

  // Clear the hint text if present
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes("(navigation log")
    )
      chatLogEl.innerHTML = "";
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
  const coreRow = getEntry(convoId, entryId);
  const title = coreRow ? coreRow.title : `(line ${convoId}:${entryId})`;
  // Use alternate line if provided, otherwise use the original dialogue text
  const dialoguetext =
    selectedAlternateLine || (coreRow ? coreRow.dialoguetext : "");

  // Get conversation type
  const conversation = getConversationById(convoId);
  const convoType = conversation?.type || "flow";

  renderCurrentEntry(
    entryOverviewEl,
    convoId,
    entryId,
    title,
    dialoguetext,
    convoType
  );

  currentConvoId = convoId;
  currentEntryId = entryId;
  currentAlternateCondition = selectedAlternateCondition;
  currentAlternateLine = selectedAlternateLine;

  // Add current entry to history log (non-clickable)
  if (addToHistory && chatLogEl) {
    const currentTitle = parseSpeakerFromTitle(title) || "(no title)";
    appendHistoryItem(
      chatLogEl,
      `${currentTitle} — #${entryId}`,
      dialoguetext,
      navigationHistory.length - 1,
      null // null means non-clickable
    );
  }

  // Show More Details
  if (moreDetailsEl) {
    moreDetailsEl.open = true;
    toggleElementVisibility(moreDetailsEl, true);
  }

  // Disable/enable root button
  if (convoRootBtn) {
    convoRootBtn.disabled = currentEntryId === null;
  }

  // Update mobile nav buttons
  updateMobileNavButtons();

  // Load child options
  loadChildOptions(convoId, entryId);

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    // Clear cache to force reload when switching between alternate views
    if (sameEntry) {
      clearCacheForEntry(convoId, entryId);
    }
    if (convoId && entryId) {
      await showEntryDetails(
        convoId,
        entryId,
        selectedAlternateCondition,
        selectedAlternateLine
      );
    } else if (convoId) {
      await showConvoDetails(convoId);
    }
  }
}
// #endregion

// #region Show Details
/* Show convo detais */
async function showConvoDetails(convoId) {
  if (!entryDetailsEl) return;

  const coreRow = getConversationById(convoId, showHidden());

  if (!coreRow) {
    entryDetailsEl.textContent = "(not found)";
  }

  const convoActor = getActorNameById(coreRow.actor);
  const convoConversantActor = getActorNameById(coreRow.conversant);

  let taskDetails = {
    displayConditionMain: coreRow.displayConditionMain,
    doneConditionMain: coreRow.doneConditionMain,
    cancelConditionMain: coreRow.cancelConditionMain,
    taskReward: coreRow.taskReward,
    taskTimed: coreRow.taskTimed,
    totalSubtasks: coreRow.totalSubtasks,
  };

  renderConvoDetails(entryDetailsEl, {
    convoId: coreRow.id,
    conversationTitle: coreRow.title,
    conversationDescription: coreRow.description,
    conversationActorId: coreRow.actor,
    conversationActorName: convoActor.name,
    conversationConversantId: coreRow.conversant,
    conversationConversantName: convoConversantActor.name,
    type: coreRow.type,
    isHidden: coreRow.isHidden,
    totalEntries: coreRow.totalEntries,
    onUse: coreRow.onUse,
    overrideDialogueCondition: coreRow.overrideDialogueCondition,
    alternateOrbText: coreRow.alternateOrbText,
    checkType: coreRow.checkType,
    condition: coreRow.condition,
    instruction: coreRow.instruction,
    placement: coreRow.placement,
    difficulty: coreRow.difficulty,
    totalEntries: coreRow.totalEntries,
    totalSubtasks: coreRow.totalSubtasks,
    taskDetails: taskDetails,
  });
}

/* Show entry details (optimized) */
async function showEntryDetails(
  convoId,
  entryId,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  if (!entryDetailsEl) return;

  // Fetch core row early so it can be referenced by cached fallback values
  const coreRow = getEntry(convoId, entryId);

  // Check cache only if viewing the original (no alternate selected)
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const cached = getCachedEntry(convoId, entryId);
    if (cached) {
      renderEntryDetails(entryDetailsEl, {
        ...cached,
        selectedAlternateCondition: null,
        selectedAlternateLine: null,
        originalDialogueText:
          cached.originalDialogueText || coreRow?.dialoguetext,
        onNavigate: navigateToEntry,
      });
      return;
    }
  }
  if (!coreRow) {
    entryDetailsEl.textContent = "(not found)";
    return;
  }

  // Fetch alternates, checks, parents/children
  const alternates = coreRow.hasalts > 0 ? getAlternates(convoId, entryId) : [];
  const checks = coreRow.hascheck > 0 ? getChecks(convoId, entryId) : [];
  const { parents, children } = getParentsChildren(convoId, entryId);
  // Get conversation data
  const convoRow = getConversationById(convoId) || {};
  // Get actor
  const entryActor = getActorNameById(coreRow.actor);
  const convoActor = getActorNameById(convoRow.actor);
  const convoConversantActor = getActorNameById(convoRow.conversant);
  // Get actor names and colors
  let entryActorName = entryActor?.name;
  let convoActorName = convoActor?.name;
  let convoConversantActorName = convoConversantActor?.name;
  let entryActorColor = entryActor?.color;
  let convoActorColor = convoActor?.color;
  let convoConversantActorColor = convoConversantActor?.color;

  const payload = {
    convoId: convoId,
    entryId: entryId,
    title: coreRow.title,
    actorId: coreRow.actor,
    actorName: entryActorName,
    actorColor: entryActorColor,
    alternates,
    checks,
    parents,
    children,
    conversationTitle: convoRow.title,
    conversationDescription: convoRow.description,
    conversationActorId: convoRow.actor,
    conversationActorName: convoActorName,
    conversationActorColor: convoActorColor,
    conversationConversantId: convoRow.conversant,
    conversationConversantName: convoConversantActorName,
    conversationConversantColor: convoConversantActorColor,
    sequence: coreRow.sequence,
    conditionstring: coreRow.conditionstring,
    userscript: coreRow.userscript,
    difficultypass: coreRow.difficultypass,
    selectedAlternateCondition: selectedAlternateCondition,
    selectedAlternateLine: selectedAlternateLine,
    originalDialogueText: coreRow.dialoguetext,
    isHidden: coreRow.isHidden,
    type: convoRow.type,
    isHidden: convoRow.isHidden,
    totalEntries: convoRow.totalEntries,
    onUse: convoRow.onUse,
    overrideDialogueCondition: convoRow.overrideDialogueCondition,
    alternateOrbText: convoRow.alternateOrbText,
    checkType: convoRow.checkType,
    condition: convoRow.condition,
    instruction: convoRow.instruction,
    placement: convoRow.placement,
    difficulty: convoRow.difficulty,
    totalEntries: convoRow.totalEntries,
    totalSubtasks: convoRow.totalSubtasks,
    onNavigate: navigateToEntry,
  };

  // Only cache the base data without alternate-specific info
  // This prevents stale alternate data from being served from cache
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const basePayload = { ...payload };
    delete basePayload.selectedAlternateCondition;
    delete basePayload.selectedAlternateLine;
    cacheEntry(convoId, entryId, basePayload);
  }

  renderEntryDetails(entryDetailsEl, payload);
}
// #endregion

// Helper: create a result `div` element for a search result (shared by desktop and mobile)
export function createSearchResultDiv(r, query) {
  const hasQuotedPhrases = /"[^"]+"/g.test(query);
  const highlightedTitle = highlightTerms(
    r.title || "",
    query,
    hasQuotedPhrases
  );
  const highlightedText = highlightTerms(
    r.dialoguetext || "",
    query,
    hasQuotedPhrases
  );
  const convo = getConversationById(r.conversationid);
  const convoType = convo ? convo.type || "flow" : "flow";
  const div = createCardItem(
    highlightedTitle,
    r.conversationid,
    r.id,
    highlightedText,
    true,
    convoType
  );
  return div;
}

// Helper: filter a list of results by a set of types (treat 'all' as no-op)
export function filterResultsByType(results, typeSet) {
  if (!typeSet || typeSet.has("all") || typeSet.size === 0) return results;
  return results.filter((r) => {
    const convo = getConversationById(r.conversationid);
    const type = convo ? convo.type || "flow" : "flow";
    return typeSet.has(type);
  });
}

function loadChildOptions(convoId, entryId) {
  try {
    entryListHeaderEl.textContent = "Next Dialogue Options";
    entryListEl.innerHTML = "";

    const { children } = getParentsChildren(convoId, entryId);

    const pairs = [];
    for (const c of children)
      pairs.push({ convoId: c.d_convo, entryId: c.d_id });

    const destRows = getEntriesBulk(pairs, showHidden());
    const destMap = new Map(destRows.map((r) => [`${r.convo}:${r.id}`, r]));

    for (const c of children) {
      const dest = destMap.get(`${c.d_convo}:${c.d_id}`);
      if (!dest) continue;
      if ((dest.title || "").toLowerCase() === "start") continue;

      const el = createCardItem(
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

function setupClearSearchInput() {
  searchClearBtn.addEventListener("click", () => {
    // Clear the unified search input and focus it
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
      // Change icon back to search icon
      toggleElementVisibility(searchClearBtn, false)
      toggleElementVisibility(searchBtn, true)
    }
  });
}

// #region Mobile Setup
function openMobileSearchScreen() {
  // Push browser history state for mobile search
  if (!isHandlingPopState) {
    pushHistoryState("search");
  }
  showSearchCount();
  toggleElementVisibility(mobileSearchScreen, true);
  mobileSearchInputWrapper.classList.add("expanded");
  searchInput.focus();

  // If there are already mobile search results rendered, re-run the search with reset = true
  // so results reflect the current search term and active filters.
  if (mobileSearchResults && mobileSearchResults.children.length > 0) {
    search(true);
  }
}

function setupMobileSearch() {
  // Open mobile search screen when the mobile header trigger is clicked
  if (mobileSearchTriggerEl) {
    mobileSearchTriggerEl.addEventListener("click", openMobileSearchScreen);
  }

  // Close mobile search screen
  mobileSearchBack.addEventListener("click", () => {
    // Use browser back to return to previous state
    window.history.back();
  });

  // // Mobile search icon button
  // const mobileSearchIconBtn = $("mobileSearchIconBtn");
  // mobileSearchIconBtn.addEventListener("click", () => {
  //   search();
  // });
  // // Clear filters button
  // if (mobileClearFilters) {
  //   mobileClearFilters.addEventListener("click", () => {
  //     // Clear conversation filter
  //     selectedConvoIds.clear();
  //     const convoCheckboxes = convoCheckboxList?.querySelectorAll(
  //       'input[type="checkbox"]'
  //     );
  //     convoCheckboxes.forEach((cb) => {
  //       cb.checked = false;
  //     });
  //     selectAllConvos.checked = true;
  //     selectAllConvos.indeterminate = false;
  //     updateConvoFilterLabel();

  //     // Clear type filter
  //     selectedTypeIds.clear();
  //     selectedTypeIds.add("all");
  //     const typeCheckboxes = typeCheckboxList?.querySelectorAll(
  //       'input[type="checkbox"][data-type]'
  //     );
  //     typeCheckboxes.forEach((cb) => {
  //       cb.checked = true;
  //     });
  //     selectAllTypes.checked = true;
  //     selectAllTypes.indeterminate = false;
  //     updateTypeFilterLabel();

  //     // Clear whole words
  //     wholeWordsCheckbox.checked = false;

  //     // Re-run search if there's an active query
  //     if ($("search")?.value) {
  //       // Prevent adding a history entry for this reset
  //       const prevPop = isHandlingPopState;
  //       isHandlingPopState = true;
  //       try {
  //         search(true);
  //       } finally {
  //         isHandlingPopState = prevPop;
  //       }
  //     }
  //   });
  // }

  // Conversation filter
  if (mobileConvoFilter) {
    mobileConvoFilter.addEventListener("click", () => {
      showMobileConvoFilter();
    });
  }

  // Setup convo filter screen
  setupConvoActorFilter();

  // Setup actor filter screen
  setupMobileActorFilter();

  // Setup type filter sheet
  setupMobileTypeFilter();
}

function setupMobileSidebar() {
  // Open sidebar
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", openConversationSection);
  }
  if (convoSidebarToggle) {
    convoSidebarToggle.addEventListener("click", openConversationSection);
  }

  // Mobile back button
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Use browser back button instead of manual history management
      window.history.back();
    });
  }

  // Mobile root button
  if (convoRootBtn) {
    convoRootBtn.addEventListener("click", async () => {
      if (currentConvoId !== null) {
        await loadEntriesForConversation(currentConvoId, false);
        updateMobileNavButtons();
      }
    });
  }
}

function openMobileNavSidebar() {
  toggleElementVisibility(mobileNavPanel, true);
  toggleElementVisibility(sidebarOverlay, true);
  mobileNavSidebarClose.addEventListener("click", closeMobileNavSidebar);
  closeConversationSection();
}

function closeMobileNavSidebar() {
  toggleElementVisibility(mobileNavPanel, false);
  toggleElementVisibility(sidebarOverlay, false);
}

function setupConversationTypesModal() {
  const helpIcon = $("helpIcon");
  const modal = $("conversationTypesModalOverlay");
  const closeBtn = modal.querySelector(".modal-close");

  function openModal() {
    toggleElementVisibility(modal, true);
  }

  function closeModal() {
    modal.classList.remove("open");
    toggleElementVisibility(modal, false);
  }

  helpIcon.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target == modal) {
      closeModal();
    }
  });

  // ESC key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display !== "none") {
      closeModal();
    }
  });
}

function updateMobileNavButtons() {
  if (!backBtn || !convoRootBtn) return;

  // Show back button if we have navigation history OR if we're not on home view
  if (
    navigationHistory.length > 1 ||
    currentConvoId !== null ||
    currentAppState !== "home"
  ) {
    backBtn.disabled = false;
    convoRootBtn.disabled = false;
  } else {
    backBtn.disabled = true;
    convoRootBtn.disabled = true;
  }
}

function closeAllSidebars() {
  const modals = document.querySelectorAll(".sidebar");
  modals.forEach((modal) => toggleElementVisibility(modals, false));
  toggleElementVisibility(sidebarOverlay, false);
}

function closeAllModals() {
  const modals = document.querySelectorAll(".modal-overlay");
  modals.forEach((modal) => toggleElementVisibility(modals, false));
}

function showMobileConvoFilter() {
  toggleElementVisibility(mobileConvoFilterWrapper, true);
}

function showMobileActorFilter() {
  toggleElementVisibility(mobileActorFilterWrapper, true);
}

function showMobileTypeFilter() {
  toggleElementVisibility(mobileTypeFilterSheet, true);
  toggleElementVisibility(typeFilterDropdown, true);
}

function setupConvoActorFilter() {
  const backBtn = $("mobileConvoFilterBack");
  // Back button - Apply Changes
  backBtn.addEventListener("click", () => {
    toggleElementVisibility(mobileConvoFilterWrapper, false);
    // Apply changes and re-run search with reset
    search(true);
  });
}

function setupMobileActorFilter() {
  const backBtn = $("mobileActorFilterBack");

  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    toggleElementVisibility(mobileActorFilterWrapper, false);
    // Apply changes and re-run search with reset
    search(true);
  });
}

function setupMobileTypeFilter() {
  // Skip setup if required elements are missing (indicates refactored HTML)
  const applyBtn = $("mobileTypeApply");

  // Close sheet when clicking outside content
  mobileTypeFilterSheet.addEventListener("click", (e) => {
    if (e.target === mobileTypeFilterSheet) {
      toggleElementVisibility(mobileTypeFilterSheet, false);
      // Apply changes and re-run search with reset
      search(true);
    }
  });

  // Apply button
  applyBtn.addEventListener("click", () => {
    // Close sheet
    toggleElementVisibility(mobileTypeFilterSheet, false);
    mobileTypeFilterSheet.classList.remove("active");
    typeFilterDropdown.classList.remove("show");
    // Explicitly run a reset search so mobile results reflect the new selection
    search(true);
  });
}
// #endregion

function setUpWholeWordsToggle() {
  const wholeWordsCheckbox = $("wholeWordsCheckbox");
  // Whole-words toggle no longer triggers a DB search; search.js listens for changes
  wholeWordsCheckbox.addEventListener("change", (e) => {
    // Intentionally do not call triggerSearch here - filtering is handled client-side
  });
}

function setUpSearch() {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      search();
    }
  });
  // On mobile, clicking the (visible) search input should open the mobile search screen
  searchInput.addEventListener("click", (e) => {
    if (mobileMediaQuery.matches) {
      openMobileSearchScreen();
    }
  });

  searchInput.addEventListener("input", (e) => {
    // Keep mobile and desktop input unified (single element used)
    // If the mobile header trigger exists, mirror the value for display
    if (mobileSearchTriggerEl)
      mobileSearchTriggerEl.value = e?.target?.value ?? "";
    if (e?.target?.value.length > 0) {
      // Show clear icon
      toggleElementVisibility(searchClearBtn, true)
      toggleElementVisibility(searchBtn, false)
    } else {
      // Show search icon
      toggleElementVisibility(searchClearBtn, false)
      toggleElementVisibility(searchBtn, true)
    }
  });
  searchBtn.addEventListener("click", () => search());
}

function setUpMainHeader() {
  const headerTitle = document.querySelector("h1");
  if (headerTitle) {
    headerTitle.style.cursor = "pointer";
    headerTitle.addEventListener("click", goBackHomeWithBrowserHistory);
  }
}

function setUpHistoryConvoRootButton() {
  if (convoRootBtn) {
    convoRootBtn.addEventListener("click", () => {
      if (currentConvoId !== null) {
        jumpToConversationRoot();
      }
    });
  }
}

function setUpHistoryBackButton() {
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      // Use browser back button instead of manual history management
      window.history.back();
    });
  }
}

async function boot() {
  // Initialize icons when DOM is ready
  document.addEventListener("DOMContentLoaded", initializeIcons);
  document.addEventListener("DOMContentLoaded", initializeUserSettings);
  // Load settings from localStorage
  applySettings();

  setUpMediaQueries();

  const SQL = await loadSqlJs();
  await initDatabase(SQL, "db/discobase.sqlite3");

  // load conversations & populate actor dropdown
  allConvos = getConversationsForTree();

  // Build tree and render (includes all types: flow, orb, task)
  conversationTree = buildTitleTree(allConvos);
  renderTree(convoListEl, conversationTree);

  // Set up conversation filter
  setupConversationFilter();
  // Set up conversation list events
  setUpConvoListEvents();

  // Handle navigateToConversation events from history dividers
  setUpChatLogEvents();

  // Set up filter dropdowns to open and close
  setUpFilterDropdowns();

  // conversation filter dropdown
  setupConvoFilter();

  // actor filter dropdown
  await populateActorDropdown();

  // type filter dropdown
  setupTypeFilter();

  // clear filters button
  setupClearFiltersBtn();

  // Make header clickable to go home
  setUpMainHeader();

  // wire search
  setUpSearch();

  // Whole words toggle - trigger search when changed
  setUpWholeWordsToggle();

  setUpHistoryBackButton();

  setUpHistoryConvoRootButton();

  updateBackButtonState();

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener("toggle", handleMoreDetailsClicked);
  }

  // Setup infinite scroll for search
  setupSearchInfiniteScroll();

  // Setup mobile sidebar
  setupMobileSidebar();
  setUpSidebarToggles();

  // Setup mobile search
  setupMobileSearch();
  setupClearSearchInput();

  // Set up mobile side menu
  setupMobileNavMenu();

  // Initialize mobile filter labels
  updateConvoFilterLabel();

  // Setup browser history handling
  setupBrowserHistory();

  // Set up conversation type modal
  setupConversationTypesModal();

  // Initialize resizable grid
  initializeResizableGrid();
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
