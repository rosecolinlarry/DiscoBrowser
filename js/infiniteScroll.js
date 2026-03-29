import { entryListEl, mobileSearchScreen, searchLoader } from "./constants.js";
import { toggleElementVisibility } from "./uiHelpers.js";
import { search } from "./search.js";

// Search pagination state
let currentSearchOffset = 0;
let currentSearchTotal = 0;
let currentSearchFilteredCount = 0; // Count after type filtering
let isLoadingMore = false;
let currentSearchActorIds = null;

export function setCurrentSearchOffset(value) {
  currentSearchOffset = value;
}
export function setCurrentSearchTotal(value) {
  currentSearchTotal = value;
}
export function setCurrentSearchFilteredCount(value) {
  currentSearchFilteredCount = value;
}
export function handleInfiniteScroll(e) {
  // Setup infinite scroll for search results
  // Check if we're near the bottom and have more results to load
  const target = e?.currentTarget;
  const scrollTop = target.scrollTop;
  const scrollHeight = target.scrollHeight;
  const clientHeight = target.clientHeight;

  const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100;

  if (scrolledToBottom &&
    !isLoadingMore &&
    currentSearchOffset < currentSearchTotal) {
    // Hide search indicator
    toggleElementVisibility(searchLoader, false);
    // Load more results
    search(false);
  }
}
// Used by search.js
export function getCurrentSearchOffset() {
  return currentSearchOffset;
}
export function incrementCurrentSearchOffset(value) {
  currentSearchOffset += value;
}
export function getCurrentSearchTotal() {
  return currentSearchTotal;
}
export function incrementCurrentSearchFilteredCount(value) {
  currentSearchFilteredCount += value;
}
export function getCurrentSearchFilteredCount() {
  return currentSearchFilteredCount;
}
export function setCurrentSearchActorIds(value) {
  currentSearchActorIds = value;
}
export function getCurrentSearchActorIds() {
  return currentSearchActorIds;
}
export function setIsLoadingMore(value) {
  isLoadingMore = value;
}
export function getIsLoadingMore() {
  return isLoadingMore;
}
export function setupSearchInfiniteScroll() {
  mobileSearchScreen.addEventListener("scroll", handleInfiniteScroll);
  entryListEl.addEventListener("scroll", handleInfiniteScroll);
}
