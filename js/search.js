import { getConvos } from "./conversationTree.js";
import {
  handleSearchResultClick,
  updateUrlWithSearchParams,
  pushHistoryState,
  getIsHandlingPopState,
} from "./navigation.js";
import {
  mobileSearchCount,
  mobileSearchResults,
  searchInput,
  searchLoader} from "./constants.js";
import { mobileSearchTrigger } from "./constants.js";
import { mobileMediaQuery } from "./constants.js";
import {
  selectedTypeIds,
  selectedConvoIds,
  selectedActorIds,
  allActors,
  switchToSearchResultsView
} from "./searchFilters.js";
import { wholeWordsCheckbox } from "./constants.js";
import {
  getCurrentSearchTotal,
  getCurrentSearchFilteredCount,
  getCurrentSearchActorIds,
  getCurrentSearchOffset,
  getIsLoadingMore,
  setCurrentSearchFilteredCount,
  setCurrentSearchTotal,
  setCurrentSearchOffset,
  setCurrentSearchActorIds,
  setIsLoadingMore,
  incrementCurrentSearchFilteredCount,
  incrementCurrentSearchOffset,
} from "./infiniteScroll.js";
import { createCardItem, highlightTerms, toggleElementVisibility } from "./uiHelpers.js";
import { searchDialogues } from "./searchDialogues.js";
import { showHidden } from "./userSettings.js";
import { execRows, getConversationById } from "./sqlHelpers.js";
import { entryListHeaderEl } from "./constants.js";
import { entryListEl } from "./constants.js";

const searchResultLimit = 50;
let currentSearchRawResults = [];
let currentSearchConvoIds = null;
let totalResultsCount;

export function applyFiltersToCurrentResults(useMobile = false) {
  const rawQuery = searchInput?.value ?? "";

  const filtered = filterAndMatchResults(getCurrentSearchRawResults(), rawQuery);

  if (useMobile) {
    if (!mobileSearchResults) return;
    mobileSearchResults.innerHTML = "";
    if (!filtered.length) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">No results found</div>';
      toggleElementVisibility(mobileSearchCount, false);
      return;
    }
    filtered.forEach((r) => {
      const div = createSearchResultDiv(r, rawQuery);
      div.addEventListener("click", handleSearchResultClick);
      mobileSearchResults.appendChild(div);
    });

    // Update search count UI: prefer DB total unless a client-only filter (whole-words) is active
    if (wholeWordsCheckbox.checked && rawQuery) {
      setSearchCount(`Search Results (${filtered.length})`);
    } else {
      setSearchCount(`Search Results (${getCurrentSearchTotal()})`);
    }
    return;
  }

  // Desktop: re-render full list
  entryListEl.innerHTML = "";
  setCurrentSearchFilteredCount(filtered.length);
  if (!filtered.length) {
    setSearchCount("(0)");
    entryListEl.innerHTML = "<div>(no matches)</div>";
    return;
  }

  entryListHeaderEl.textContent = `Search Results`;

  if(wholeWordsCheckbox.checked) {
    setSearchCount(`(${filtered.length})`);
  }
  else {
    setSearchCount(`(${totalResultsCount})`)
  }

  filtered.forEach((r) => {
    const div = createSearchResultDiv(r, rawQuery);
    div.addEventListener("click", handleSearchResultClick);

    entryListEl.appendChild(div);
  });

  // Update URL with search params
  updateUrlWithSearchParams(rawQuery, selectedTypeIds);
}
export function showSearchCount() {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    toggleElementVisibility(element, true);
  });
}
export function hideSearchCount() {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    toggleElementVisibility(element, false);
  });
}
export function search(resetSearch = true) {
  window.dataLayer = window.dataLayer || [];

  if (mobileMediaQuery.matches) {
    performMobileSearch(resetSearch);
    return;
  }

  searchInput.value = searchInput?.value?.trim() ?? "";
  if (resetSearch) {
    // Push browser history state for search view
    if (!getIsHandlingPopState()) {
      pushHistoryState("search", { query: searchInput.value });
    }

    // Starting a new search
    setCurrentSearchOffset(0);
  }

  // Always update convo IDs from current filter selection (even when re-filtering)
  const tempCurrentSearchConvoIds =
    selectedConvoIds.size === 0 || selectedConvoIds.size === getConvos().length
      ? null
      : Array.from(selectedConvoIds);
  currentSearchConvoIds = tempCurrentSearchConvoIds;
  // Always update actor IDs from current filter selection (even when re-filtering)
  const tempCurrentSearchActorIds =
    selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
      ? null
      : Array.from(selectedActorIds);
  setCurrentSearchActorIds(tempCurrentSearchActorIds);
  if (resetSearch) {
    toggleElementVisibility(searchLoader, true);

    // Hide homepage, show dialogue content for search
    switchToSearchResultsView();
  }

  window.dataLayer.push({
    event: "virtualSearch",
    searchTerm: searchInput.value,
    resetSearch: resetSearch,
    currentSearchOffset: getCurrentSearchOffset(),
    selectedActorIds: selectedActorIds,
    selectedConvoIds: selectedConvoIds,
  });

  if (getIsLoadingMore()) return;
  setIsLoadingMore(true);

  try {
    const response = searchDialogues(
      searchInput.value,
      searchResultLimit,
      getCurrentSearchActorIds(),
      true, // filterStartInput
      getCurrentSearchOffset(),
      currentSearchConvoIds, // conversationIds
      showHidden(),
    );

    const { results: res, total } = response;
    totalResultsCount = total;
    setCurrentSearchTotal(totalResultsCount);

    // Append to raw results (clear if a new search)
    if (resetSearch) {
      setCurrentSearchRawResults([...res]);
    } else {
      setCurrentSearchRawResults([...getCurrentSearchRawResults(), ...res]);
    }

    // Helper: escape regex tokens
    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Parse query into quoted phrases and remaining words (approximation of DB parsing)
    const rawQuery = searchInput.value || "";
    const quotedPhrases = [];
    const quotedRegex = /"([^"]+)"/g;
    let qmatch;
    while ((qmatch = quotedRegex.exec(rawQuery)) !== null) {
      quotedPhrases.push(qmatch[1]);
    }

    const remaining = rawQuery.replace(/"[^"]+"/g, "").trim();
    const words = remaining ? remaining.split(/\s+/) : [];

    // Filter a list of results by type and whole-words (if enabled)
    function filterAndMatch(results) {
      let filtered = filterResultsByType(results, selectedTypeIds);

      if (wholeWordsCheckbox.checked && rawQuery) {
        filtered = filtered.filter((r) => {
          const hay = `${r.dialoguetext || ""} ${r.title || ""}`.toLowerCase();

          // All quoted phrases must exist as substrings
          for (const phrase of quotedPhrases) {
            if (!hay.includes(phrase.toLowerCase())) return false;
          }

          // All words must be matched as whole words using \b
          for (const w of words) {
            const wtrim = w.trim();
            if (!wtrim) continue;
            const re = new RegExp(
              `\\b${escapeRegExp(wtrim.toLowerCase())}\\b`,
              "i",
            );
            if (!re.test(hay)) return false;
          }

          return true;
        });
      }

      return filtered;
    }

    // When starting a new search, reset UI and counts
    if (resetSearch) {
      entryListHeaderEl.textContent = "Search Results";
      entryListEl.innerHTML = "";
      setCurrentSearchFilteredCount(0);

      const initialFiltered = filterAndMatch(getCurrentSearchRawResults());
      if (!initialFiltered.length) {
        setSearchCount("(0)");
        entryListEl.innerHTML = "<div>(no matches)</div>";
        // Update URL with search params even if no results
        updateUrlWithSearchParams(searchInput.value, selectedTypeIds);
        return;
      }

      // Update filtered count (used internally) but display DB total or client-filtered total
      const tempCurrentSearchFilteredCount =
        getCurrentSearchFilteredCount() + initialFiltered.length;
      setCurrentSearchFilteredCount(tempCurrentSearchFilteredCount);
      entryListHeaderEl.textContent = `Search Results`;
      if (wholeWordsCheckbox.checked && rawQuery) {
        setSearchCount(`(${initialFiltered.length})`);
      } else {
        setSearchCount(`(${getCurrentSearchTotal()})`);
      }

      // Render initial set
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", handleSearchResultClick);

        entryListEl.appendChild(div);
      });

      // Update URL with search params
      updateUrlWithSearchParams(searchInput.value, selectedTypeIds);
    } else {
      // Pagination: filter only the newly fetched items and append them
      const newFiltered = filterAndMatch(res);

      // Update filtered count
      incrementCurrentSearchFilteredCount(newFiltered.length);
      entryListHeaderEl.textContent = `Search Results`;
      // Show DB total for pagination
      setSearchCount(`(${total})`);

      newFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", handleSearchResultClick);

        entryListEl.appendChild(div);
      });
    }

    // Update offset for next load (based on database results, not filtered)
    incrementCurrentSearchOffset(res.length);

    // Remove any existing loading indicator
    toggleElementVisibility(searchLoader, false);

    // Add loading indicator if there are more results in the database and we got results this time
    if (res.length > 0 && getCurrentSearchOffset() < getCurrentSearchTotal()) {
      toggleElementVisibility(searchLoader, true);
    }
  } catch (e) {
    console.error("Search error", e);
    if (resetSearch) {
      entryListEl.textContent = "Search error";
    }
  } finally {
    setIsLoadingMore(false);
    toggleElementVisibility(searchLoader, false);
  }
}
function getQueryTokens(rawQuery) {
  // Helper: tokenize query into quoted phrases and words (approximate DB parsing)
  const quotedPhrases = [];
  const quotedRegex = /"([^"]+)"/g;
  let qmatch;
  while ((qmatch = quotedRegex.exec(rawQuery)) !== null) {
    quotedPhrases.push(qmatch[1]);
  }

  const remaining = rawQuery.replace(/"[^"]+"/g, "").trim();
  const words = remaining ? remaining.split(/\s+/) : [];
  return { quotedPhrases, words };
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchesWholeWords(result, tokens) {
  const hay =
    `${result.dialoguetext || ""} ${result.title || ""}`.toLowerCase();

  for (const phrase of tokens.quotedPhrases) {
    if (!hay.includes(phrase.toLowerCase())) return false;
  }

  for (const w of tokens.words) {
    const wtrim = w.trim();
    if (!wtrim) continue;
    const re = new RegExp(`\\b${escapeRegExp(wtrim.toLowerCase())}\\b`, "i");
    if (!re.test(hay)) return false;
  }

  return true;
}
function filterAndMatchResults(results, rawQuery) {
  // Filter results by type and whole-words (if enabled); for mobile, convo filtering and mobile type set are used
  const tokens = getQueryTokens(rawQuery || "");

  let typeSet = selectedTypeIds;

  let filtered = filterResultsByType(results, typeSet);

  if (selectedConvoIds && selectedConvoIds.size > 0) {
    filtered = filtered.filter((r) => selectedConvoIds.has(r.conversationid));
  }

  if (wholeWordsCheckbox.checked && rawQuery) {
    filtered = filtered.filter((r) => matchesWholeWords(r, tokens));
  }

  return filtered;
}
function performMobileSearch(resetSearch = true) {
  if (!mobileMediaQuery.matches) return;
  if (!searchInput) return;
  searchInput.value = searchInput.value?.trim();
  mobileSearchTrigger.value = searchInput.value;
  if (resetSearch) {
    // Starting a new search
    // Always update convo IDs from current filter selection (even when re-filtering)
    const tempCurrentSearchConvoIds =
      selectedConvoIds.size === 0 || selectedConvoIds.size === getConvos().length
        ? null
        : Array.from(selectedConvoIds);
    currentSearchConvoIds  = tempCurrentSearchConvoIds;
    // Always update actor IDs from current filter selection (even when re-filtering)
    const tempCurrentSearchActorIds =
      selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
        ? null
        : Array.from(selectedActorIds);
    setCurrentSearchActorIds(tempCurrentSearchActorIds);
    setCurrentSearchOffset(0);
    toggleElementVisibility(searchLoader, true);
    if (mobileSearchResults) {
      mobileSearchResults.innerHTML = "";
    }
  }

  window.dataLayer.push({
    event: "virtualSearch",
    searchTerm: searchInput.value,
    resetSearch: resetSearch,
    currentSearchOffset: getCurrentSearchOffset(),
    selectedActorIds: selectedActorIds,
    selectedConvoIds: selectedConvoIds,
  });

  if (getIsLoadingMore()) return;
  setIsLoadingMore(true);

  try {
    // Always query without whole-word restriction at DB layer; we'll filter client-side
    let response;
    const rawQuery = searchInput.value?.trim() ?? "";
    if (
      !rawQuery &&
      selectedTypeIds &&
      selectedTypeIds.size === 1 &&
      (Array.from(selectedTypeIds)[0] === "task" ||
        Array.from(selectedTypeIds)[0] === "orb")
    ) {
      const type = Array.from(selectedTypeIds)[0];
      const convos = getConversationsByType(type, showHidden());
      response = { results: convos, total: convos.length };
    } else {
      response = searchDialogues(
        searchInput.value,
        searchResultLimit,
        getCurrentSearchActorIds(),
        true, // filterStartInput
        getCurrentSearchOffset(),
        currentSearchConvoIds, // conversationIds
        showHidden(),
      );
    }
    const { results, total } = response;
    // Ensure global total reflects DB/query results for mobile as well
    setCurrentSearchTotal(total);
    // Append to raw results
    if (resetSearch) {
      setCurrentSearchRawResults([...results]);
    } else {
      setCurrentSearchRawResults([...getCurrentSearchRawResults(), ...results]);
    }

    toggleElementVisibility(searchLoader, false);

    if (resetSearch) {
      setCurrentSearchFilteredCount(0);
    }

    // Filter newly fetched results and append (for pagination) or render all (for reset)
    if (resetSearch) {
      const initialFiltered = filterAndMatchResults(
        getCurrentSearchRawResults(),
        searchInput.value,
      );
      if (initialFiltered.length === 0) {
        mobileSearchResults.innerHTML =
          '<div class="mobile-search-prompt">No results found</div>';
        toggleElementVisibility(mobileSearchCount, false);
        return;
      }

      // Render initial set
      mobileSearchResults.innerHTML = "";
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, searchInput.value);
        div.addEventListener("click", handleSearchResultClick);

        mobileSearchResults.appendChild(div);
      });
      setCurrentSearchFilteredCount(initialFiltered.length);
    } else {
      // Pagination: filter only the newly fetched items and append them
      const newFiltered = filterAndMatchResults(results, searchInput.value);

      // Update filtered count
      incrementCurrentSearchFilteredCount(newFiltered.length);

      newFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, searchInput.value);
        div.addEventListener("click", handleSearchResultClick);

        mobileSearchResults.appendChild(div);
      });
    }

    // Update header with current count: prefer DB total unless client-only whole-words filter is active
    if (wholeWordsCheckbox.checked && (searchInput.value || "").trim()) {
      setSearchCount(`Search Results (${getCurrentSearchFilteredCount()})`);
    } else {
      setSearchCount(`Search Results (${total})`);
    }

    // Update offset for next load (based on database results, not filtered)
    incrementCurrentSearchOffset(results.length);

    // Update URL with search params (on initial search)
    if (resetSearch) {
      updateUrlWithSearchParams(searchInput.value, selectedTypeIds);
    }

    // Add loading indicator if there are more results in the database and we got results this time
    if (results.length > 0 && getCurrentSearchOffset() < getCurrentSearchTotal()) {
      toggleElementVisibility(searchLoader, true);
    }
  } catch (e) {
    console.error("Mobile search error:", e);
    if (resetSearch) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">Error performing search</div>';
    }
  } finally {
    // Remove any existing loading indicator
    setIsLoadingMore(false);
    toggleElementVisibility(searchLoader, false);
  }
}
function setSearchCount(value) {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    element.textContent = value;
    toggleElementVisibility(element, true);
  });
}
function filterResultsByType(results, typeSet) {
  // Helper: filter a list of results by a set of types (treat 'all' as no-op)
  if (!typeSet || typeSet.has("all") || typeSet.size === 0) return results;
  return results.filter((r) => {
    const convo = getConversationById(r.conversationid);
    const type = convo ? convo.type || "flow" : "flow";
    return typeSet.has(type);
  });
}
function getConversationsByType(type, showHidden) {
  // Helper: fetch conversations by type (used for type-only searches with no text)
  if (!type) return [];
  let where = `type='${type}'`;
  if (!showHidden) {
    where += ` AND isHidden != 1`;
  }
  const sql = `SELECT id as conversationid, null as id, description as dialoguetext, title, actor, isHidden FROM conversations WHERE ${where} ORDER BY title;`;
  return execRows(sql);
}
function setCurrentSearchRawResults(value) {
  // Keep raw (DB) results so we can apply client-side filters like whole-words without re-querying
  currentSearchRawResults = value;
}
function getCurrentSearchRawResults() {
  return currentSearchRawResults;
}
export function createSearchResultDiv(r, query) {
  // Create a result `div` element for a search result (shared by desktop and mobile)
  const hasQuotedPhrases = /"[^"]+"/g.test(query);
  const highlightedTitle = highlightTerms(
    r.title || "",
    query,
    hasQuotedPhrases
  );
  const highlightedText = highlightTerms(
    r.dialoguetext || "",
    query,
    hasQuotedPhrases
  );
  const convo = getConversationById(r.conversationid);
  const convoType = convo ? convo.type || "flow" : "flow";
  const div = createCardItem(
    highlightedTitle,
    r.conversationid,
    r.id,
    highlightedText,
    true,
    convoType
  );
  div.dataset.actor = r.actor;
  div.dataset.dialogueText = r.dialoguetext;
  div.dataset.isHidden = r.isHidden;
  div.dataset.title = r.title;
  div.dataset.isAlternate = r.isAlternate === true;
  div.dataset.alternateCondition = r.alternatecondition;
  return div;
}

