import { entryListEl, mobileSearchResults } from "./main.js";
import {
  search,
  currentSearchTotal,
  setCurrentSearchTotal,
  setCurrentSearchOffset,
  currentSearchOffset,
  isLoadingMore,
  setIsLoadingMore,
} from "./search.js";
import { $ } from "./ui.js";

// Search pagination state

const searchLoader = $("searchLoader");
const mobileSearchLoader = $("mobileSearchLoader");

// Setup infinite scroll for search results
export function setupSearchInfiniteScroll() {
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
      // Hide search indicator
      if (searchLoader) {
        searchLoader.classList.add("hidden");
      }
      // Load more results
      search(false);
    }
  });
} // Setup infinite scroll for mobile search results
export function setupMobileSearchInfiniteScroll() {
  if (!mobileSearchResults) return;

  mobileSearchResults.addEventListener("scroll", () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = mobileSearchResults.scrollTop;
    const scrollHeight = mobileSearchResults.scrollHeight;
    const clientHeight = mobileSearchResults.clientHeight;

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

    if (
      scrolledToBottom &&
      !isLoadingMore &&
      currentSearchOffset < currentSearchTotal
    ) {
      // Remove loading indicator
      if (mobileSearchLoader) {
        mobileSearchLoader.classList.add("hidden");
      }
      // Load more results
      search(false);
    }
  });
}
