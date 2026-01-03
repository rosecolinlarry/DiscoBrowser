import { searchDialogues as getSearchResults } from "./db.js";
import {
  isHandlingPopState,
  pushHistoryState,
  selectedActorIds,
  allConvos,
  allActors,
  searchLoader,
  currentEntryContainerEl,
  entryListEl,
  searchResultLimit,
  filterResultsByType,
  selectedTypeIds,
  entryListHeaderEl,
  createSearchResultDiv,
  jumpToConversationRoot,
  navigateToEntry,
  highlightConversationInTree,
  closeMobileSearchScreen,
  mobileSearchCount,
  mobileSearchLoader,
  mobileSearchResults,
  mobileSearchTrigger,
  selectedConvoIds,
  setNavigationHistory,
  mobileMediaQuery,
  desktopMediaQuery,
  tabletMediaQuery,
  setCurrentConvoId,
} from "./main.js";
import { $, getParsedIntOrDefault } from "./ui.js";
import { showHidden } from "./userSettings.js";

// Search pagination state
export let currentSearchOffset = 0;
export let currentSearchConvoIds = null;
export let currentSearchActorIds = null;
export let currentSearchTotal = 0;
export let currentSearchFilteredCount = 0; // Count after type filtering
export let isLoadingMore = false;

const wholeWordsCheckbox = $("wholeWordsCheckbox");
const searchInput = $("search");

// Keep raw (DB) results so we can apply client-side filters like whole-words without re-querying
export let currentSearchRawResults = [];

// Helper: tokenize query into quoted phrases and words (approximate DB parsing)
function getQueryTokens(rawQuery) {
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
  const hay = `${result.dialoguetext || ""} ${
    result.title || ""
  }`.toLowerCase();

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

// Filter results by type and whole-words (if enabled); for mobile, convo filtering and mobile type set are used
function filterAndMatchResults(results, rawQuery, { useMobile = false } = {}) {
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

export function applyFiltersToCurrentResults(useMobile = false) {
  const rawQuery = searchInput?.value ?? "";

  const filtered = filterAndMatchResults(currentSearchRawResults, rawQuery, {
    useMobile,
  });

  if (useMobile) {
    if (!mobileSearchResults) return;
    mobileSearchResults.innerHTML = "";
    if (!filtered.length) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">No results found</div>';
      if (mobileSearchCount) mobileSearchCount.classList.add("hidden");
      return;
    }
    // TODO KA consolidate search results to one dom element
    filtered.forEach((r) => {
      const div = createSearchResultDiv(r, rawQuery);
      div.addEventListener("click", () => {
        const cid = getParsedIntOrDefault(r.conversationid);
        const eid = getParsedIntOrDefault(r.id);

        const alternateCondition = r.isAlternate ? r.alternatecondition : null;
        const alternateLine = r.isAlternate ? r.dialoguetext : null;
        if (cid && !eid) {
          setCurrentConvoId(cid);
          jumpToConversationRoot();
        } else {
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
        }

        closeMobileSearchScreen();
      });

      mobileSearchResults.appendChild(div);
    });

    // Update search count UI
    setSearchCount(
      `Search Results (${filtered.length} of ${currentSearchTotal})`
    );
    return;
  }

  // Desktop: re-render full list
  entryListEl.innerHTML = "";
  currentSearchFilteredCount = filtered.length;
  if (!filtered.length) {
    setSearchCount("(0)");
    entryListEl.innerHTML = "<div>(no matches)</div>";
    return;
  }

  entryListHeaderEl.textContent = `Search Results`;
  setSearchCount(`(${currentSearchFilteredCount} of ${currentSearchTotal})`);

  filtered.forEach((r) => {
    const div = createSearchResultDiv(r, rawQuery);
    div.addEventListener("click", () => {
      const cid = getParsedIntOrDefault(r.conversationid);
      const eid = getParsedIntOrDefault(r.id);

      setNavigationHistory([{ convoId: cid, entryId: null }]);
      const alternateCondition = r.isAlternate ? r.alternatecondition : null;
      const alternateLine = r.isAlternate ? r.dialoguetext : null;

      if (cid && !eid) {
        setCurrentConvoId(cid);
        jumpToConversationRoot();
        return;
      }

      navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
      highlightConversationInTree(cid);
      document.querySelector(".selected")?.scrollIntoView(true);
    });

    entryListEl.appendChild(div);
  });
}

// Listen for whole-words toggle and re-filter existing results (do not re-run DB search)
wholeWordsCheckbox.addEventListener("change", () => {
  applyFiltersToCurrentResults(mobileMediaQuery.matches);
});

export function setCurrentSearchOffset(value) {
  currentSearchOffset = value;
}
export function setCurrentSearchTotal(value) {
  currentSearchTotal = value;
}
export function setCurrentSearchFilteredCount(value) {
  currentSearchFilteredCount = value;
}
export function setIsLoadingMore(value) {
  isLoadingMore = value;
}
export function setCurrentSearchConvoIds(value) {
  currentSearchConvoIds = value;
}
export function setCurrentSearchActorIds(value) {
  currentSearchActorIds = value;
}

function setSearchCount(value) {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    element.textContent = value;
    element.classList.remove("hidden");
  });
}

export function showSearchCount() {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    element.classList.remove("hidden");
  });
}

export function hideSearchCount() {
  const searchCounters = document.querySelectorAll(".search-count");
  searchCounters.forEach((element) => {
    element.classList.add("hidden");
  });
}

export function search(resetSearch = true) {
  if (mobileMediaQuery.matches) {
    performMobileSearch(resetSearch);
    return;
  }

  searchInput.value = searchInput?.value?.trim() ?? "";

  if (resetSearch) {
    // Push browser history state for search view
    if (!isHandlingPopState) {
      pushHistoryState("search", { query: searchInput.value });
    }

    // Starting a new search
    currentSearchOffset = 0;
  }

  // Always update convo IDs from current filter selection (even when re-filtering)
  currentSearchConvoIds =
    selectedConvoIds.size === 0 || selectedConvoIds.size === allConvos.length
      ? null
      : Array.from(selectedConvoIds);

  // Always update actor IDs from current filter selection (even when re-filtering)
  currentSearchActorIds =
    selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
      ? null
      : Array.from(selectedActorIds);

  if (resetSearch) {
    searchLoader?.classList.remove("hidden");

    // Hide homepage, show dialogue content for search
    const homePageContainer = $("homePageContainer");
    const dialogueContent = $("dialogueContent");

    if (homePageContainer) {
      homePageContainer.style.display = "none";
    }
    if (dialogueContent) {
      dialogueContent.style.display = "flex";
    }

    // Hide current entry and make search take full space
    if (currentEntryContainerEl) currentEntryContainerEl.style.display = "none";
    const entryListContainer = entryListEl?.closest(".entry-list");
    if (entryListContainer) {
      entryListContainer.classList.add("full-height");
      entryListContainer.classList.remove("compact");
    }
    if (entryListEl) {
      entryListEl.classList.remove("compact");
    }

    entryListEl.innerHTML = ""; // This clears both innerHTML and textContent
  }

  if (isLoadingMore) return;
  isLoadingMore = true;

  try {
    const response = getSearchResults(
      searchInput.value,
      searchResultLimit,
      currentSearchActorIds,
      true, // filterStartInput
      currentSearchOffset,
      currentSearchConvoIds, // conversationIds
      showHidden()
    );

    const { results: res, total } = response;
    currentSearchTotal = total;

    // Append to raw results (clear if a new search)
    if (resetSearch) {
      currentSearchRawResults = [...res];
    } else {
      currentSearchRawResults = [...currentSearchRawResults, ...res];
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
              "i"
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
      currentSearchFilteredCount = 0;

      const initialFiltered = filterAndMatch(currentSearchRawResults);
      if (!initialFiltered.length) {
        setSearchCount("(0)");
        entryListEl.innerHTML = "<div>(no matches)</div>";
        return;
      }

      // Update filtered count
      currentSearchFilteredCount += initialFiltered.length;
      entryListHeaderEl.textContent = `Search Results`;
      setSearchCount(`(${currentSearchFilteredCount} of ${currentSearchTotal})`);

      // Render initial set
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", () => {
          const cid = getParsedIntOrDefault(r.conversationid);
          const eid = getParsedIntOrDefault(r.id);

          setNavigationHistory([{ convoId: cid, entryId: null }]);
          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;

          if (cid && !eid) {
            setCurrentConvoId(cid);
            jumpToConversationRoot();
            return;
          }

          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
          highlightConversationInTree(cid);
          document.querySelector(".selected")?.scrollIntoView(true);
        });

        entryListEl.appendChild(div);
      });
    } else {
      // Pagination: filter only the newly fetched items and append them
      const newFiltered = filterAndMatch(res);

      // Update filtered count
      currentSearchFilteredCount += newFiltered.length;
      entryListHeaderEl.textContent = `Search Results`;
      // TODO KA this number gets weird when filtering by types and needing to scroll. Consider just showing the total results and not pagination state.
      setSearchCount(`(${currentSearchFilteredCount} of ${total})`);

      newFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", () => {
          const cid = getParsedIntOrDefault(r.conversationid);
          const eid = getParsedIntOrDefault(r.id);

          setNavigationHistory([{ convoId: cid, entryId: null }]);
          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;

          if (cid && !eid) {
            setCurrentConvoId(cid);
            jumpToConversationRoot();
            return;
          }

          navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
          highlightConversationInTree(cid);
          document.querySelector(".selected")?.scrollIntoView(true);
        });

        entryListEl.appendChild(div);
      });
    }

    // Update offset for next load (based on database results, not filtered)
    currentSearchOffset += res.length;

    // Remove any existing loading indicator
    searchLoader?.classList.add("hidden");

    // Add loading indicator if there are more results in the database and we got results this time
    if (res.length > 0 && currentSearchOffset < currentSearchTotal) {
      searchLoader?.classList.remove("hidden");
    }
  } catch (e) {
    console.error("Search error", e);
    if (resetSearch) {
      entryListEl.textContent = "Search error";
    }
  } finally {
    isLoadingMore = false;
    searchLoader?.classList.add("hidden");
  }
}

function performMobileSearch(resetSearch = true) {
  if (!mobileMediaQuery.matches) return;
  if (!searchInput) return;
  searchInput.value = searchInput.value?.trim();
  mobileSearchTrigger.value = searchInput.value;
  if (resetSearch) {
    // Starting a new search
    // Always update convo IDs from current filter selection (even when re-filtering)
    currentSearchConvoIds =
      selectedConvoIds.size === 0 || selectedConvoIds.size === allConvos.length
        ? null
        : Array.from(selectedConvoIds);
    // Always update actor IDs from current filter selection (even when re-filtering)
    currentSearchActorIds =
      selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
        ? null
        : Array.from(selectedActorIds);
    currentSearchOffset = 0;
    mobileSearchLoader?.classList.remove("hidden");
    if (mobileSearchResults) {
      mobileSearchResults.innerHTML = "";
    }
  }

  if (isLoadingMore) return;
  isLoadingMore = true;

  try {
    // Always query without whole-word restriction at DB layer; we'll filter client-side
    const response = getSearchResults(
      searchInput.value,
      searchResultLimit,
      currentSearchActorIds,
      true,
      currentSearchOffset,
      currentSearchConvoIds,
      showHidden()
    );
    const { results, total } = response;
    currentSearchTotal = total;

    // Append to raw results
    if (resetSearch) {
      currentSearchRawResults = [...results];
    } else {
      currentSearchRawResults = [...currentSearchRawResults, ...results];
    }

    mobileSearchLoader?.classList.add("hidden");

    if (resetSearch) {
      currentSearchFilteredCount = 0;
    }

    // Filter newly fetched results and append (for pagination) or render all (for reset)
    if (resetSearch) {
      const initialFiltered = filterAndMatchResults(
        currentSearchRawResults,
        searchInput.value,
        { useMobile: true }
      );
      if (initialFiltered.length === 0) {
        mobileSearchResults.innerHTML =
          '<div class="mobile-search-prompt">No results found</div>';
        if (mobileSearchCount) mobileSearchCount.classList.add("hidden");
        return;
      }

      // Render initial set
      mobileSearchResults.innerHTML = "";
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, searchInput.value);
        div.addEventListener("click", () => {
          const cid = getParsedIntOrDefault(r.conversationid);
          const eid = getParsedIntOrDefault(r.id);

          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;
          if (cid && !eid) {
            setCurrentConvoId(cid);
            jumpToConversationRoot();
          } else {
            navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
          }

          closeMobileSearchScreen();
        });

        mobileSearchResults.appendChild(div);
      });

      currentSearchFilteredCount = initialFiltered.length;
    } else {
      // Pagination: filter only the newly fetched items and append them
      const newFiltered = filterAndMatchResults(results, searchInput.value, {
        useMobile: true,
      });

      // Update filtered count
      currentSearchFilteredCount += newFiltered.length;

      newFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, searchInput.value);
        div.addEventListener("click", () => {
          const cid = getParsedIntOrDefault(r.conversationid);
          const eid = getParsedIntOrDefault(r.id);

          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null;
          const alternateLine = r.isAlternate ? r.dialoguetext : null;
          if (cid && !eid) {
            setCurrentConvoId(cid);
            jumpToConversationRoot();
          } else {
            navigateToEntry(cid, eid, true, alternateCondition, alternateLine);
          }

          closeMobileSearchScreen();
        });

        mobileSearchResults.appendChild(div);
      });
    }

    // Update header with current count
    setSearchCount(
      `Search Results (${currentSearchFilteredCount} of ${total})`
    );

    // Update offset for next load (based on database results, not filtered)
    currentSearchOffset += results.length;

    // Remove any existing loading indicator
    mobileSearchLoader?.classList.add("hidden");

    // Add loading indicator if there are more results in the database and we got results this time
    if (results.length > 0 && currentSearchOffset < currentSearchTotal) {
      mobileSearchLoader?.classList.remove("hidden");
    }
  } catch (e) {
    console.error("Mobile search error:", e);
    mobileSearchLoader?.classList.add("hidden");
    if (resetSearch) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">Error performing search</div>';
    }
  } finally {
    isLoadingMore = false;
    mobileSearchLoader?.classList.add("hidden");
  }
}
