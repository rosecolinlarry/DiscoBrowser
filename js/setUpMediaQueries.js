import { defaultMobileColumns } from "./constants.js";
import { defaultColumns } from "./constants.js";
import { browserGrid } from "./constants.js";
import { searchBtn } from "./constants.js";
import { searchClearBtn } from "./constants.js";
import { convoSidebar } from "./constants.js";
import { historySidebar } from "./constants.js";
import { setUpResizableColumns } from "./resizableColumns.js";
import { applySettings } from "./userSettings.js";
import { $, toggleElementVisibility, toggleElementVisibilityBySelector } from "./uiHelpers.js";
import { closeAllSidebars, closeAllModals } from "./closeElementsHelpers.js";
import { closeMobileSearchScreen } from "./setUpMobile.js";
import {
  convoSidebarToggle,
  desktopMediaQuery,
  historySidebarToggle,
  mobileMediaQuery,
  tabletMediaQuery,
} from "./constants.js";

export async function setUpMediaQueries() {
  desktopMediaQuery.addEventListener("change", handleMediaQueryChange);
  tabletMediaQuery.addEventListener("change", handleMediaQueryChange);
  mobileMediaQuery.addEventListener("change", handleMediaQueryChange);
  await handleMediaQueryChange();
}

async function handleMediaQueryChange() {
  const historySection = $("historySection");
  const convoSection = $("convoSection");
  const mobileSearchContainer = $("mobileSearchContainer");
  closeAllSidebars();
  closeMobileSearchScreen();
  closeAllModals();
  if (desktopMediaQuery.matches) {
    toggleElementVisibility(historySidebarToggle, false)
    toggleElementVisibility(convoSidebarToggle, false);
    toggleElementVisibility(mobileSearchContainer, false);
    browserGrid.style.gridTemplateColumns = defaultColumns;
    setUpResizableColumns();
    const browserEl = $("browser");
    browserEl?.prepend(convoSection);
    browserEl?.appendChild(historySection);
  } else if (tabletMediaQuery.matches) {
    toggleElementVisibility(historySidebarToggle, true);
    toggleElementVisibility(convoSidebarToggle, true);
    toggleElementVisibility(mobileSearchContainer, false);
    browserGrid.style.gridTemplateColumns = defaultMobileColumns;
    toggleElementVisibilityBySelector(".resize-handle", false);
    historySidebar?.appendChild(historySection);
    convoSidebar?.appendChild(convoSection);
  } else if (mobileMediaQuery.matches) {
    toggleElementVisibility(historySidebarToggle, true);
    toggleElementVisibility(convoSidebarToggle, false);
    toggleElementVisibility(mobileSearchContainer, true);
    browserGrid.style.gridTemplateColumns = defaultMobileColumns;
    toggleElementVisibilityBySelector(".resize-handle", false);
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
  moveElementsById(
    "wholeWordsButton",
    "wholeWordsButtonWrapper",
    "mobileWholeWordsButtonWrapper",
  );
}
function moveClearFiltersBtn() {
  moveElementsById(
    "clearFiltersBtn",
    "clearFiltersBtnWrapper",
    "mobileClearFiltersBtnWrapper",
  );
}
function moveSearchLoader() {
  moveElementsById(
    "searchLoader",
    "searchLoaderWrapper",
    "mobileSearchLoaderWrapper",
  );
}
function moveSearchInput() {
  const clearButtonElWrapper = document.querySelector(
    ".clear-icon-btn-wrapper.desktop",
  );
  const mobileClearButtonElWrapper = document.querySelector(
    ".clear-icon-btn-wrapper.mobile",
  );
  const searchButtonElWrapper = document.querySelector(
    ".search-icon-btn-wrapper.desktop",
  );
  const mobileSearchButtonElWrapper = document.querySelector(
    ".search-icon-btn-wrapper.mobile",
  );
  moveElementsById("search", "searchInputWrapper", "mobileSearchInputWrapper");
  moveElements(
    searchClearBtn,
    clearButtonElWrapper,
    mobileClearButtonElWrapper,
  );
  moveElements(searchBtn, searchButtonElWrapper, mobileSearchButtonElWrapper);
}
function moveConvoFilterDropdown() {
  moveElementsById(
    "convoFilterDropdown",
    "convoFilterWrapper",
    "mobileConvoFilterWrapper",
  );
  moveElementsById(
    "convoFilterLabel",
    "convoFilterLabelWrapper",
    "mobileConvoFilterLabelWrapper",
  );
}
function moveActorFilterDropdown() {
  moveElementsById(
    "actorFilterDropdown",
    "actorFilterWrapper",
    "mobileActorFilterWrapper",
  );
  moveElementsById(
    "actorFilterLabel",
    "actorFilterLabelWrapper",
    "mobileActorFilterLabelWrapper",
  );
}
function moveTypeFilterDropdown() {
  moveElementsById(
    "typeFilterDropdown",
    "typeFilterWrapper",
    "mobileTypeFilterWrapper",
  );
  moveElementsById(
    "typeFilterLabel",
    "typeFilterDropdownLabelWrapper",
    "mobileTypeFilterWrapperLabel",
  );
}
function moveElementsById(
  elId,
  srcElWrapperId,
  destElWrapperId,
  mediaQuery = mobileMediaQuery,
) {
  // Move elements when media query changes
  const el = $(elId);
  const srcElWrapper = $(srcElWrapperId);
  const destElWrapper = $(destElWrapperId);
  moveElements(el, srcElWrapper, destElWrapper, mediaQuery);
}
function moveElements(
  el,
  srcElWrapper,
  destElWrapper,
  mediaQuery = mobileMediaQuery,
) {
  // Move elements when media query changes
  if (mediaQuery?.matches) {
    destElWrapper?.appendChild(el);
  } else {
    srcElWrapper?.appendChild(el);
  }
}
