import { loadEntriesForConversation } from "./loadEntriesForConversation.js";
import {
  goBackHomeWithBrowserHistory,
  pushHistoryState,
  setIsHandlingPopState,
  getIsHandlingPopState,
} from "./navigation.js";
import { backBtn } from "./constants.js";
import { openConversationSidebar } from "./setUpSidebarToggles.js";
import { convoRootBtn, mobileSearchTrigger, searchInput } from "./constants.js";
import { mobileActorFilterWrapper } from "./constants.js";
import { mobileConvoFilterWrapper } from "./constants.js";
import { mobileMediaQuery } from "./constants.js";
import {
  getCurrentConvoId,
  getNavigationHistory,
  getCurrentAppState,
} from "./navigation.js";
import { toggleElementVisibility, $ } from "./uiHelpers.js";
import {
  showSearchCount,
  search,
} from "./search.js";
import { mobileSearchResults } from "./constants.js";
import { mobileSearchCount } from "./constants.js";
import { closeAllSidebars } from "./closeElementsHelpers.js";
import { openSettings } from "./userSettings.js";
import { mobileSearchScreen } from "./constants.js";

const mobileActorFilter = $("mobileActorFilter");
const mobileConvoFilter = $("mobileConvoFilter");
const typeFilterDropdown = $("typeFilterDropdown");
const mobileSearchInputWrapper = $("mobileSearchInputWrapper");
const mobileNavHome = $("mobileNavHome");
const mobileNavSettings = $("mobileNavSettings");
const mobileNavSearch = $("mobileNavSearch");
const mobileTypeFilter = $("mobileTypeFilter"); // Button
const mobileTypeFilterSheet = $("mobileTypeFilterSheet"); // Checklist

export function setUpMobile() {
  setupMobileSidebar();
  setupMobileSearch();
  setupMobileNavMenu();
}
export function openMobileSearchScreen() {
  // Push browser history state for mobile search
  if (!getIsHandlingPopState()) {
    pushHistoryState("search");
  }
  showSearchCount();
  closeAllSidebars();
  toggleElementVisibility(mobileSearchScreen, true);
  mobileSearchInputWrapper.classList.add("expanded");
  searchInput.focus();

  // On mobile, always re-run the search when opening the mobile search screen
  // to ensure results and counts are restored. Prevent duplicate history pushes
  // by temporarily marking as handling a popstate event while running the search.
  if (mobileMediaQuery.matches) {
    const prevPop = getIsHandlingPopState();
    setIsHandlingPopState(true);
    try {
      search(true);
    } finally {
      setIsHandlingPopState(prevPop);
    }
  } else {
    // No query and no results — make sure counters are hidden
    if (mobileSearchCount) toggleElementVisibility(mobileSearchCount, false);
  }
}
export function closeMobileSearchScreen() {
  toggleElementVisibility(mobileSearchScreen, false);
  mobileSearchInputWrapper.classList.remove("expanded");

  // Clear mobile search UI state to avoid stale results being visible when closed
  if (mobileSearchResults) {
    mobileSearchResults.innerHTML = "";
  }
  if (mobileSearchCount) {
    toggleElementVisibility(mobileSearchCount, false);
  }
}
export function updateMobileNavButtons() {
  if (!backBtn || !convoRootBtn) return;

  // Show back button if we have navigation history OR if we're not on home view
  if (
    getNavigationHistory().length > 1 ||
    getCurrentConvoId() !== null ||
    getCurrentAppState() !== "home"
  ) {
    backBtn.disabled = false;
    convoRootBtn.disabled = false;
  } else {
    backBtn.disabled = true;
    convoRootBtn.disabled = true;
  }
}
function setupMobileNavMenu() {
  mobileNavHome.addEventListener("click", goBackHomeWithBrowserHistory);
  mobileNavSettings.addEventListener("click", openSettings);
  mobileNavSearch.addEventListener("click", openMobileSearchScreen);
}
function setupMobileSearch() {
  mobileConvoFilter.addEventListener("click", showMobileConvoFilter);
  mobileActorFilter.addEventListener("click", showMobileActorFilter);
  mobileTypeFilter.addEventListener("click", showMobileTypeFilter);
  // Open mobile search screen when the mobile header trigger is clicked
  if (mobileSearchTrigger) {
    mobileSearchTrigger.addEventListener("click", openMobileSearchScreen);
  }

  // Close mobile search screen
  const mobileSearchBack = $("mobileSearchBack");
  function handleMobileSearchBackClick() {
    // Use browser back to return to previous state
    window.history.back();
    closeMobileSearchScreen();
  }
  mobileSearchBack?.addEventListener("click", handleMobileSearchBackClick);

  // Setup convo filter screen
  setupMobileConvoFilter();

  // Setup actor filter screen
  setupMobileActorFilter();

  // Setup type filter sheet
  setupMobileTypeFilter();
}
function setupMobileSidebar() {
  // Open sidebar
  const mobileSidebarToggle = $("mobileSidebarToggle");
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener("click", openConversationSidebar);
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
    async function handleMobileConvoRootButtonClick() {
      if (getCurrentConvoId() !== null) {
        await loadEntriesForConversation(getCurrentConvoId(), false);
        updateMobileNavButtons();
      }
    }
    convoRootBtn.addEventListener("click", handleMobileConvoRootButtonClick);
  }
}
function showMobileConvoFilter() {
  // Close the mobile search screen visually and push a history entry for the filter page (mobile only)
  closeMobileSearchScreen();
  if (mobileMediaQuery.matches && !getIsHandlingPopState()) {
    pushHistoryState("mobile-filter", { filter: "convo" });
  }
  toggleElementVisibility(mobileConvoFilterWrapper, true);
}
function showMobileActorFilter() {
  // Close the mobile search screen visually and push a history entry for the filter page (mobile only)
  closeMobileSearchScreen();
  if (mobileMediaQuery.matches && !getIsHandlingPopState()) {
    pushHistoryState("mobile-filter", { filter: "actor" });
  }
  toggleElementVisibility(mobileActorFilterWrapper, true);
}
function showMobileTypeFilter() {
  toggleElementVisibility(mobileTypeFilterSheet, true);
  toggleElementVisibility(typeFilterDropdown, true);
}
function setupMobileConvoFilter() {
  function handleMobileConvoFilterBackButtonClick() {
    // Use browser back on mobile to return to the previous view so history is kept in sync
    const wrapper = $("mobileConvoFilterWrapper"); // Checklist
    if (mobileMediaQuery.matches) {
      window.history.back();
    } else {
      // Desktop: just close the filter screen and apply changes
      toggleElementVisibility(wrapper, false);
      search(true);
    }
  }
  function handleMobileConvoFilterWrapperClick(e) {
    // Close when clicking outside the content area (mobile only)
    const wrapper = $("mobileConvoFilterWrapper"); // Checklist
    if (e.target === wrapper) {
      if (mobileMediaQuery.matches) {
        window.history.back();
      } else {
        toggleElementVisibility(wrapper, false);
        search(true);
      }
    }
  }
  const backBtn = $("mobileConvoFilterBack");
  backBtn?.addEventListener("click", handleMobileConvoFilterBackButtonClick);

  mobileConvoFilterWrapper?.addEventListener(
    "click",
    handleMobileConvoFilterWrapperClick,
  );
}
function setupMobileActorFilter() {
  const backBtn = $("mobileActorFilterBack");
  backBtn?.addEventListener("click", handleMobileActorFilterBackButtonClick);

  function handleMobileActorFilterBackButtonClick(e) {
    if (mobileMediaQuery.matches) {
      window.history.back();
    } else {
      toggleElementVisibility(e.target, false);
      search(true);
    }
  }

  function handleMobileActorFilterWrapperClick(e) {
    const wrapper = $("mobileActorFilterWrapper");
    // Close when clicking outside the content area
    if (e.target === wrapper) {
      if (mobileMediaQuery.matches) {
        window.history.back();
      } else {
        toggleElementVisibility(e.target, false);
        search(true);
      }
    }
  }
  mobileActorFilterWrapper?.addEventListener(
    "click",
    handleMobileActorFilterWrapperClick,
  );
}
function setupMobileTypeFilter() {
  // Skip setup if required elements are missing (indicates refactored HTML)
  const applyBtn = $("mobileTypeApply");
  const bottomSheet = $("bottomSheet");

  function handleMobileTypeFilterSheetClick(e) {
    // Close sheet when clicking outside content
    if (e.target === mobileTypeFilterSheet) {
      toggleElementVisibility(e.target, false);
      // Apply changes and re-run search with reset
      search(true);
    }
  }

  function handleBottomSheetClick(e) {
    // Keep sheet open if clicking bottom sheet
    e.stopPropagation();
    e.preventDefault();
  }

  bottomSheet?.addEventListener("click", handleBottomSheetClick);
  mobileTypeFilterSheet?.addEventListener(
    "click",
    handleMobileTypeFilterSheetClick,
  );

  function handleMobileConvoTypeButtonClick() {
    const mobileTypeFilterSheet = $("mobileTypeFilterSheet");
    // Close sheet
    toggleElementVisibility(mobileTypeFilterSheet, false);
    toggleElementVisibility(typeFilterDropdown, false);
    // Explicitly run a reset search so mobile results reflect the new selection
    search(true);
  }
  // Apply button
  applyBtn?.addEventListener("click", handleMobileConvoTypeButtonClick);
}
