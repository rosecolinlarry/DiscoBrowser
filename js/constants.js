import { $ } from "./uiHelpers.js";

export const defaultColumns = "352px 1fr 280px";
export const defaultMobileColumns = "1fr";
export const STORAGE_KEY = "discobrowser_grid_columns";

export const currentEntryContainerEl = $("currentEntryContainer");
export const moreDetailsEl = $("moreDetails");
export const entryOverviewEl = $("entryOverview");
export const entryListEl = $("entryList");
export const entryListHeaderEl = $("entryListHeader");
export const mobileConvoFilterWrapper = $("mobileConvoFilterWrapper");
export const mobileActorFilterWrapper = $("mobileActorFilterWrapper");
export const entryCache = new Map();
export const convoCheckboxList = $("convoCheckboxList");
export const actorCheckboxList = $("actorCheckboxList");
export const typeCheckboxList = $("typeCheckboxList");
export const selectAllTypes = $("selectAllTypes");
export const searchLoader = $("searchLoader");
export const searchInput = $("search");
export const homePageContainer = $("homePageContainer");
export const dialogueContent = $("dialogueContent");

export const sidebarOverlay = $("sidebarOverlay");

export const mobileMediaQuery = window.matchMedia("(max-width: 768px)");
export const tabletMediaQuery = window.matchMedia(
  "(min-width: 769px) and (max-width: 1024px)"
);
export const desktopMediaQuery = window.matchMedia("(min-width: 1025px)");
export const mobileSearchScreen = $("mobileSearchScreen");

export const historySidebar = $("historySidebar");
export const historySidebarToggle = $("historySidebarToggle");
export const convoSidebar = $("convoSidebar");
export const convoSidebarToggle = $("convoSidebarToggle");

export const chatLogEl = $("chatLog");
export const convoRootBtn = $("convoRootBtn");
export const mobileSearchTrigger = $("mobileSearchTrigger");
export const wholeWordsCheckbox = $("wholeWordsCheckbox");
export const mobileSearchCount = $("mobileSearchCount");
export const mobileSearchResults = $("mobileSearchResults");
export const searchClearBtn = $("searchClearBtn");
export const searchBtn = $("searchBtn");
export const browserGrid = $("browser");
export const backBtn = $("backBtn");

