import { entryListEl, mobileSearchScreen, searchLoader } from "./main.js";
import {
  search,
  currentSearchTotal,
  setCurrentSearchTotal,
  setCurrentSearchOffset,
  currentSearchOffset,
  isLoadingMore,
  setIsLoadingMore,
} from "./search.js";
import { $, toggleElementVisibility } from "./ui.js";

// Search pagination state

// Setup infinite scroll for search results
export function setupSearchInfiniteScroll() {
  mobileSearchScreen.addEventListener("scroll", (e) => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = e?.target?.scrollTop;
    const scrollHeight = e?.target?.scrollHeight;
    const clientHeight = e?.target?.clientHeight;

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (
      scrolledToBottom &&
      !isLoadingMore &&
      currentSearchOffset < currentSearchTotal
    ) {
      // Hide search indicator
      toggleElementVisibility(searchLoader, false);
      // Load more results
      search(false);
    }
  });

  entryListEl.addEventListener("scroll", (e) => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = e.target.scrollTop;
    const scrollHeight = e.target.scrollHeight;
    const clientHeight = e.target.clientHeight;

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (
      scrolledToBottom &&
      !isLoadingMore &&
      currentSearchOffset < currentSearchTotal
    ) {
      // Hide search indicator
      toggleElementVisibility(searchLoader, false);
      // Load more results
      search(false);
    }
  });
}
