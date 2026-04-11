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
import { setProgressBarPercent, toggleHomepageLoader, moveBetweenPercent } from "./homepageLoader.js";
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
  setProgressBarPercent(0, "Loading...");

  toggleHomepageLoader(true);

  setProgressBarPercent(5, "Restoring user settings...");
  
  await injectUserSettingsTemplate();

  setProgressBarPercent(10, "Injecting icons...");

  await injectIconTemplates();

  setProgressBarPercent(15, "Setting up media queries...");
  
  await setUpMediaQueries();

  setProgressBarPercent(20);

  moveBetweenPercent(20,30, "Loading SQL JS libraries...");

  const SQL = await loadSqlJs();

  setProgressBarPercent(31);

  moveBetweenPercent(32,80, "Initializing Database...");

  await initDatabase(SQL, "db/discobase.sqlite3");

  setProgressBarPercent(81, "Fetching conversations...");

  buildConvoTreeAndRender();

  setProgressBarPercent(85, "Setting up components...");

  setUpNavigation();

  setUpFilterDropdowns();

  setupClearFiltersBtn();

  setUpMainHeader();

  setUpSearch();

  setupClearSearchInput();

  setUpMoreDetails();

  setupSearchInfiniteScroll();

  setUpSidebarToggles();

  setProgressBarPercent(88, "Preparing responsive view...");

  setUpMobile();
  
  setProgressBarPercent(91, "Setting up history management...");

  await setupBrowserHistory();

  setProgressBarPercent(92, "Handling initial URL navigation...");

  await handleInitialUrlNavigation();

  setProgressBarPercent(94, "Setting up conversation types modal...");

  await setupConversationTypesModal();
  
  setProgressBarPercent(95, "Injecting homepage container...");
  
  await injectTemplate("homepage.html", "homePageContainer");

  setProgressBarPercent(100, "Almost done...");

  toggleHomepageLoader(false);
}

boot().catch((err) => console.error("boot error", err));