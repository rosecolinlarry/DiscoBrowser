import { buildConvoTreeAndRender } from "./conversationTree.js";
import { setupConversationTypesModal } from "./setUpConversationTypesModal.js";
import { injectIconTemplates } from "./iconHelpers.js";
import { loadSqlJs } from "./loadSqlJs.js";
import {
  setupBrowserHistory,
  handleInitialUrlNavigation,
  setUpNavigation,
} from "./navigation.js";
import { setUpMobile } from "./setUpMobile.js";
import { setUpMediaQueries } from "./setUpMediaQueries.js";
import { toggleHomepageLoader } from "./homepageLoader.js";
import { setUpSearch } from "./searchFilters.js";
import { setupClearFiltersBtn } from "./searchFilters.js";
import { setupClearSearchInput } from "./searchFilters.js";
import { setUpFilterDropdowns } from "./searchFilters.js";
import { setUpMainHeader } from "./header.js";
import { setupSearchInfiniteScroll } from "./infiniteScroll.js";
import { setUpSidebarToggles } from "./setUpSidebarToggles.js";
import { setUpMoreDetails } from "./showDetailsHelpers.js";
import { initDatabase } from "./sqlHelpers.js";
import { injectUserSettingsTemplate } from "./userSettings.js";
import { injectTemplate } from "./uiHelpers.js";

export async function boot() {
  toggleHomepageLoader(true);
  await injectUserSettingsTemplate();
  await injectIconTemplates();
  await setUpMediaQueries();

  const SQL = await loadSqlJs();
  await initDatabase(SQL, "db/discobase.sqlite3");
  buildConvoTreeAndRender();
  setUpNavigation();
  setUpFilterDropdowns();
  setupClearFiltersBtn();
  setUpMainHeader();
  setUpSearch();
  setupClearSearchInput();
  setUpMoreDetails();
  setupSearchInfiniteScroll();
  setUpSidebarToggles();
  setUpMobile();
  await setupBrowserHistory();
  await handleInitialUrlNavigation();
  await setupConversationTypesModal();
  await injectTemplate("homepage.html", "homePageContainer");
  toggleHomepageLoader(false);
}

boot().catch((err) => console.error("boot error", err));
