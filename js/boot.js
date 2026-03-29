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
import { setProgressBarPercent, toggleHomepageLoader } from "./homepageLoader.js";
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
  setProgressBarPercent(0);

  toggleHomepageLoader(true);

  setProgressBarPercent(5);

  await injectUserSettingsTemplate();
  
  setProgressBarPercent(10);

  await injectIconTemplates();

  setProgressBarPercent(15);

  await setUpMediaQueries();

  setProgressBarPercent(20);
  
  const SQL = await loadSqlJs();
  
  setProgressBarPercent(70);

  await initDatabase(SQL, "db/discobase.sqlite3");
  
  setProgressBarPercent(75);

  buildConvoTreeAndRender();

  setProgressBarPercent(80);

  setUpNavigation();
  setUpFilterDropdowns();
  setupClearFiltersBtn();
  setUpMainHeader();
  setUpSearch();
  setupClearSearchInput();
  setUpMoreDetails();
  setupSearchInfiniteScroll();
  setUpSidebarToggles();

  setProgressBarPercent(85);

  setUpMobile();
  
  setProgressBarPercent(89);

  await setupBrowserHistory();

  setProgressBarPercent(90);

  await handleInitialUrlNavigation();

  setProgressBarPercent(92);

  await setupConversationTypesModal();
  
  setProgressBarPercent(95);
  
  await injectTemplate("homepage.html", "homePageContainer");

  setProgressBarPercent(100);

  toggleHomepageLoader(false);
}

boot().catch((err) => console.error("boot error", err));
