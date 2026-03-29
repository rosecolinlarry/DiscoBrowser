import { $, toggleElementVisibility } from "./uiHelpers.js";
import {
  actorCheckboxList,
  convoCheckboxList,
  currentEntryContainerEl,
  dialogueContent,
  entryListEl,
  homePageContainer,
  searchInput,
  selectAllTypes,
  typeCheckboxList,
  wholeWordsCheckbox
} from "./constants.js";
import { applyFiltersToCurrentResults, search } from "./search.js";
import { mobileMediaQuery } from "./constants.js";
import { getDistinctActors } from "./sqlHelpers.js";
import { getConvos } from "./conversationTree.js";
import { searchBtn } from "./constants.js";
import { searchClearBtn } from "./constants.js";
import { openMobileSearchScreen } from "./setUpMobile.js";
import { mobileSearchTrigger } from "./constants.js";
import { setCurrentSearchOffset, setCurrentSearchFilteredCount } from "./infiniteScroll.js";
import { getCurrentAppState, getIsHandlingPopState, setIsHandlingPopState } from "./navigation.js";

export let allActors = [];
export let selectedConvoIds = new Set();
export let selectedActorIds = new Set();
export let selectedTypeIds = new Set(["flow", "orb", "task"]); // All types selected by default

const selectAllActors = $("selectAllActors");
const actorFilterLabel = $("actorFilterLabel"); // Text
const actorSearchInput = $("actorSearch");
const actorFilterDropdown = $("actorFilterDropdown"); // Checklist
const actorAddToSelectionBtn = $("actorAddToSelection");

const selectAllConvos = $("selectAllConvos");
const convoFilterLabel = $("convoFilterLabel"); // Text
const convoFilterDropdown = $("convoFilterDropdown"); // Checklist
const clearFiltersBtn = $("clearFiltersBtn");

const typeFilterLabel = $("typeFilterLabel");

let filteredActors = [];
let filteredConvos = [];
let openDropdown = null;

export function setUpFilterDropdowns() {
  const dropdownButtons = document.querySelectorAll(".filter-dropdown-button");
  const allDropdowns = document.querySelectorAll(".filter-dropdown");

  // Prevent clicks inside any dropdown from bubbling to document
  allDropdowns.forEach((dd) =>
    dd.addEventListener("click", (ev) => ev.stopPropagation()),
  );

  // Single document-level click handler to close the open dropdown when clicking outside
  document.addEventListener("click", handleOutsideDropdownClick);

  dropdownButtons.forEach((dropdownButton) => {
    function handleDropdownButtonClick(e) {
      e.stopPropagation();

      const filterDropdown =
        e.target.parentElement?.querySelector(".filter-dropdown");
      if (!filterDropdown) return;

      const shouldOpen = filterDropdown.classList.contains("hidden");

      // Close any other open dropdown first
      if (getOpenDropdown() && getOpenDropdown() !== filterDropdown) {
        toggleElementVisibility(getOpenDropdown(), false);
      }

      // Toggle the clicked dropdown
      toggleElementVisibility(filterDropdown, shouldOpen);

      // Update currently open reference
      setOpenDropdown(shouldOpen ? filterDropdown : null);
    }
    dropdownButton.addEventListener("click", handleDropdownButtonClick);

    // conversation filter dropdown
    setUpConvoFilterDropdown();

    // actor filter dropdown
    setUpActorFilterDropdown();

    // type filter dropdown
    setUpTypeFilterDropdown();

    // whole words toggle
    setUpWholeWordsToggle();
  });
}
export function updateActorFilterLabel() {
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
export function updateConvoFilterLabel() {
  if (
    selectedConvoIds.size === 0 ||
    selectedConvoIds.size === getConvos().length
  ) {
    convoFilterLabel.textContent = "All Conversations";
  } else if (selectedConvoIds.size === 1) {
    const convoId = Array.from(selectedConvoIds)[0];
    const convo = getConvos().find((c) => c.id === convoId);
    convoFilterLabel.textContent = convo ? convo.title : "1 Conversation";
  } else {
    convoFilterLabel.textContent = `${selectedConvoIds.size} Conversations`;
  }
}
export function updateTypeFilterLabel() {
  if (selectedTypeIds.size === 0 || selectedTypeIds.size === 3) {
    typeFilterLabel.textContent = "All Types";
  } else if (selectedTypeIds.size === 1) {
    const type = Array.from(selectedTypeIds)[0];
    typeFilterLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  } else {
    typeFilterLabel.textContent = `${selectedTypeIds.size} Types`;
  }
}
export function setupClearSearchInput() {
  function handleSearchClearButtonClick(e) {
    // Clear the unified search input and focus it
    if (searchInput) {
      const searchClearBtn = e.target;
      searchInput.value = "";
      searchInput.focus();
      // Change icon back to search icon
      toggleElementVisibility(searchClearBtn, false);
      toggleElementVisibility(searchBtn, true);
    }
  }
  searchClearBtn.addEventListener("click", handleSearchClearButtonClick);
}
export function setupClearFiltersBtn() {
  if (!clearFiltersBtn) return;
  function handleClearFiltersButtonClick(e) {
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
  }
  clearFiltersBtn.addEventListener("click", handleClearFiltersButtonClick);
}
export function setUpSearch() {
  function handleSearchInputKeyDown(e) {
    if (e.key === "Enter") {
      search();
    }
  }
  function handleSearchInputClick() {
    // On mobile, clicking the (visible) search input should open the mobile search screen
    if (mobileMediaQuery.matches) {
      openMobileSearchScreen();
    }
  }
  function handleSearchInputEvent(e) {
    // Keep mobile and desktop input unified (single element used)
    // If the mobile header trigger exists, mirror the value for display
    if (mobileSearchTrigger) mobileSearchTrigger.value = e?.target?.value ?? "";
    if (e?.target?.value.length > 0) {
      // Show clear icon
      toggleElementVisibility(searchClearBtn, true);
      toggleElementVisibility(searchBtn, false);
    } else {
      // Show search icon
      toggleElementVisibility(searchClearBtn, false);
      toggleElementVisibility(searchBtn, true);
    }
  }
  searchInput.addEventListener("keydown", handleSearchInputKeyDown);
  searchInput.addEventListener("click", handleSearchInputClick);
  searchInput.addEventListener("input", handleSearchInputEvent);
  searchBtn.addEventListener("click", search);
}
export function triggerSearch(e) {
  e.preventDefault();

  if (searchInput.value) {
    // Always reset search when filters change to clear old results
    // But only push history state if not already in search view
    const isAlreadySearching = getCurrentAppState() === "search";
    if (isAlreadySearching) {
      // Already in search view, manually reset and search without pushing history
      setCurrentSearchOffset(0);
      setCurrentSearchFilteredCount(0);
      entryListEl.innerHTML = "";
      // Prevent pushHistoryState by temporarily marking as handling popstate
      const prevPop = getIsHandlingPopState();
      setIsHandlingPopState(true);
      try {
        search(true);
      } finally {
        setIsHandlingPopState(prevPop);
      }
    } else {
      // First time searching, push history state
      search(true);
    }
  }
}
export function switchToSearchResultsView() {
  toggleElementVisibility(homePageContainer, false);
  toggleElementVisibility(dialogueContent, true);

  // Hide current entry and make search take full space
  toggleElementVisibility(currentEntryContainerEl, false);
  const entryListContainer = entryListEl?.closest(".entry-list");
  if (entryListContainer) {
    entryListContainer.classList.add("full-height");
    entryListContainer.classList.remove("compact");
  }
  if (entryListEl) {
    entryListEl.classList.remove("compact");
  }

  entryListEl.innerHTML = "";
}

function setOpenDropdown(value) {
  openDropdown = value;
}
function getOpenDropdown() {
  return openDropdown;
}
function filterActors(actorSearchInput) {
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
function handleOutsideDropdownClick() {
  const dropdowns = document.querySelectorAll(".filter-dropdown");
  dropdowns.forEach((dropdown) => toggleElementVisibility(dropdown, false));
}
function setUpActorFilterDropdown() {
  allActors = getDistinctActors();
  filteredActors = [...allActors];

  // Search filter
  function handleActorFilterInput(e) {
    filterActors(e.target);
  }
  actorSearchInput?.addEventListener("input", handleActorFilterInput);

  // Select All checkbox
  function handleSelectAllActorsCheckboxChange(e) {
    const isChecked = e.target.checked;
    const checkboxes = actorCheckboxList.querySelectorAll(
      'input[type="checkbox"]',
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
  }
  selectAllActors?.addEventListener(
    "change",
    handleSelectAllActorsCheckboxChange,
  );

  // Add to Selection button
  function handleActorAddToSelectionButtonClick() {
    selectedActorIds = new Set();
    const checkboxes = actorCheckboxList.querySelectorAll(
      'input[type="checkbox"]:checked',
    );
    checkboxes.forEach((cb) => {
      if (!selectedActorIds.has(cb.dataset.actorId)) {
        selectedActorIds.add(parseInt(cb.dataset.actorId));
      }
    });

    // Clear search and show all with current selection
    actorSearchInput.value = "";
    filterActors(actorSearchInput);
    updateActorFilterLabel();

    if (mobileMediaQuery.matches) {
      // Mobile: close via history so previous view is restored
      window.history.back();
    } else {
      // Desktop: close the dropdown and re-run a reset search
      toggleElementVisibility(actorFilterDropdown, false);
      search(true);
    }
  }
  actorAddToSelectionBtn?.addEventListener(
    "click",
    handleActorAddToSelectionButtonClick,
  );

  renderActorCheckboxes(allActors);
}
function renderActorCheckboxes(actors) {
  function handleActorCheckboxChange(e) {
    const checkbox = e.target;
    const actorId = checkbox.dataset.actorId;
    if (checkbox.checked) {
      selectedActorIds.add(actorId);
    } else {
      selectedActorIds.delete(actorId);
    }
    updateActorSelectAllState();
    updateActorFilterLabel();
    triggerSearch(e);
  }
  actorCheckboxList.innerHTML = "";

  actors.forEach((actor) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.actorId = actor.id;
    checkbox.checked = selectedActorIds.has(actor.id);
    checkbox.addEventListener("change", handleActorCheckboxChange);

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
    'input[type="checkbox"]',
  );
  const visibleActorIds = Array.from(visibleCheckboxes).map((cb) =>
    parseInt(cb.dataset.actorId),
  );

  const allSelected =
    visibleActorIds.length > 0 &&
    visibleActorIds.every((id) => selectedActorIds.has(id));
  const someSelected = visibleActorIds.some((id) => selectedActorIds.has(id));

  selectAllActors.checked = allSelected;
  selectAllActors.indeterminate = !allSelected && someSelected;
}
function renderConvoList(conversations) {
  const listContainer = $("convoCheckboxList");
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

    function handleFilterCheckboxChange(e, conversations) {
      const checkbox = e.target;
      const convoId = checkbox.dataset.convoId;
      if (checkbox.checked) {
        selectedConvoIds.add(convoId);
      } else {
        selectedConvoIds.delete(convoId);
      }

      updateConvoSelectAllState(conversations);
      updateConvoFilterLabel();
      triggerSearch(e);
    }
    checkbox.addEventListener("change", (e) =>
      handleFilterCheckboxChange(e, conversations),
    );
    const span = document.createElement("span");
    span.textContent = convo.title;

    label.appendChild(checkbox);
    label.appendChild(span);
    convoCheckboxList.appendChild(label);
  });
}
function setUpConvoFilterDropdown() {
  const convoFilterSearchInput = $("convoSearch");
  const addToSelectionBtn = $("convoAddToSelection");

  // Search filter
  function handleConvoFilterSearchInput(e) {
    const convoFilterSearch = e.currentTarget;
    const query = convoFilterSearch.value.toLowerCase().trim();
    const convos = getConvos();
    if (!query) {
      renderConvoList(convos);
      return;
    }

    const filtered = getConvos(convos).filter((c) => {
      return (
        (c.title || "").toLowerCase().includes(query) ||
        c.id.toString().includes(query)
      );
    });

    renderConvoList(filtered);
  }
  convoFilterSearchInput?.addEventListener(
    "input",
    handleConvoFilterSearchInput,
  );

  // Add to Selection button - apply changes
  function handleAddToSelectionButtonClick() {
    const convoFilterSearch = $("convoSearch");
    selectedConvoIds = new Set();
    const checkboxes = convoCheckboxList.querySelectorAll(
      'input[type="checkbox"]:checked',
    );
    checkboxes.forEach((cb) => {
      if (!selectedConvoIds.has(cb.dataset.convoId)) {
        selectedConvoIds.add(parseInt(cb.dataset.convoId));
      }
    });
    // Clear search and show all with current selection
    convoFilterSearch.value = "";
    renderConvoList(getConvos());
    updateConvoFilterLabel();
    if (mobileMediaQuery.matches) {
      // Mobile: use history to close the mobile filter so history entries remain consistent
      window.history.back();
    } else {
      // Desktop: close the dropdown and apply search
      toggleElementVisibility(convoFilterDropdown, false);
      search(true);
    }
  }
  addToSelectionBtn?.addEventListener("click", handleAddToSelectionButtonClick);

  // Select All checkbox
  function handleSelectAllCheckboxChange(e) {
    if (e.target.checked) {
      // Select all filtered convos
      filteredConvos.forEach((c) => selectedConvoIds.add(c.id));
    } else {
      // Deselect all filtered convos
      filteredConvos.forEach((c) => selectedConvoIds.delete(c.id));
    }
    renderConvoList(filteredConvos);
  }
  selectAllConvos?.addEventListener("change", handleSelectAllCheckboxChange);

  // Initial render
  const convos = getConvos();
  renderConvoList(convos);
}
function updateConvoSelectAllState(conversations) {
  const selectAllCheckbox = $("selectAllConvos");
  if (selectAllCheckbox) {
    const allSelected =
      conversations.length > 0 &&
      conversations.every((c) => selectedConvoIds.has(c.id));
    const someSelected = conversations.some((c) => selectedConvoIds.has(c.id));
    selectAllCheckbox.checked = allSelected;
    selectAllCheckbox.indeterminate = someSelected && !allSelected;
  }
}
function setUpTypeFilterDropdown() {
  // Select All checkbox
  function handleSelectAllConvoTypeChange(e) {
    const isChecked = e.target.checked;
    const checkboxes = typeCheckboxList.querySelectorAll(
      'input[type="checkbox"][data-type]',
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
  }
  selectAllTypes.addEventListener("change", handleSelectAllConvoTypeChange);

  // Individual type checkboxes
  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]',
  );
  function handleConvoTypeCheckboxChange(e) {
    const cb = e.target;
    const type = cb.dataset.type;
    if (cb.checked) {
      selectedTypeIds.add(type);
    } else {
      selectedTypeIds.delete(type);
    }

    updateTypeSelectAllState();
    updateTypeFilterLabel();
    triggerSearch(e);
  }
  typeCheckboxes.forEach((cb) => {
    cb.addEventListener("change", handleConvoTypeCheckboxChange);
  });

  updateTypeFilterLabel();
}
function updateTypeSelectAllState() {
  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]',
  );
  const allTypes = Array.from(typeCheckboxes).map((cb) => cb.dataset.type);

  const allSelected =
    allTypes.length > 0 && allTypes.every((type) => selectedTypeIds.has(type));
  const someSelected = allTypes.some((type) => selectedTypeIds.has(type));

  selectAllTypes.checked = allSelected;
  selectAllTypes.indeterminate = !allSelected && someSelected;
}
async function handleWholeWordsCheckboxChange() {
  // Preserve the total count computed by the last DB search — whole-words
  // filtering should only affect the filtered count, not the underlying total
  // number of results available from the database.
  switchToSearchResultsView();
  applyFiltersToCurrentResults(mobileMediaQuery.matches);
}
function setUpWholeWordsToggle() {
  // Listen for whole-words toggle and re-filter existing results (do not re-run DB search)
  wholeWordsCheckbox.addEventListener("change", handleWholeWordsCheckboxChange);
}
