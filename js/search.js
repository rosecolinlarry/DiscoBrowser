import { searchDialogues as getSearchResults, getConversationsByType } from "./db.js";
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
  mobileSearchResults,
  mobileSearchTrigger,
  selectedConvoIds,
  setNavigationHistory,
  mobileMediaQuery,
  desktopMediaQuery,
  tabletMediaQuery,
  setCurrentConvoId,
  homePageContainer,
  dialogueContent,
  searchInput
} from "./main.js";
import {
  $,
  toggleElementVisibility
} from "./ui.js";
import { showHidden } from "./userSettings.js";

// Search pagination state
export let currentSearchOffset = 0;
export let currentSearchConvoIds = null;
export let currentSearchActorIds = null;
export let currentSearchTotal = 0;
export let currentSearchFilteredCount = 0; // Count after type filtering
export let isLoadingMore = false;

const wholeWordsCheckbox = $("wholeWordsCheckbox");


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
      toggleElementVisibility(mobileSearchCount, false);
      return;
    }
    // TODO KA consolidate search results to one dom element
    filtered.forEach((r) => {
      const div = createSearchResultDiv(r, rawQuery);
      div.addEventListener("click", () => {
        const cid = r.conversationid;
        const eid = r.id;

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

    // Update search count UI: prefer DB total unless a client-only filter (whole-words) is active
    if (wholeWordsCheckbox.checked && rawQuery) {
      setSearchCount(`Search Results (${filtered.length})`);
    } else {
      setSearchCount(`Search Results (${currentSearchTotal})`);
    }
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
  // If a client-only filter (whole-words) is active and there's a query,
  // show the client-side filtered total; otherwise show the DB total.
  if (wholeWordsCheckbox.checked && rawQuery) {
    setSearchCount(`(${filtered.length})`);
  } else {
    setSearchCount(`(${currentSearchTotal})`);
  }

  filtered.forEach((r) => {
    const div = createSearchResultDiv(r, rawQuery);
    div.addEventListener("click", () => {
      const cid = r.conversationid;
      const eid = r.id;

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
  // Preserve the total count computed by the last DB search — whole-words
  // filtering should only affect the filtered count, not the underlying total
  // number of results available from the database.
  const prevTotal = currentSearchTotal;
  applyFiltersToCurrentResults(mobileMediaQuery.matches);
  if (prevTotal > 0 && currentSearchTotal === 0) {
    setCurrentSearchTotal(prevTotal);
  }
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
    toggleElementVisibility(element, true);
  });
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
    toggleElementVisibility(searchLoader, true);

    // Hide homepage, show dialogue content for search
    toggleElementVisibility(homePageContainer, false);
    toggleElementVisibility(dialogueContent, true);

    // Hide current entry and make search take full space
    toggleElementVisibility(currentEntryContainerEl, false);
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

      // Update filtered count (used internally) but display DB total or client-filtered total
      currentSearchFilteredCount += initialFiltered.length;
      entryListHeaderEl.textContent = `Search Results`;
      if (wholeWordsCheckbox.checked && rawQuery) {
        setSearchCount(`(${initialFiltered.length})`);
      } else {
        setSearchCount(`(${currentSearchTotal})`);
      }

      // Render initial set
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", () => {
          const cid = (r.conversationid);
          const eid = (r.id);

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
      // Show DB total for pagination
      setSearchCount(`(${total})`);

      newFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, rawQuery);
        div.addEventListener("click", () => {
          const cid = (r.conversationid);
          const eid = (r.id);

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
    toggleElementVisibility(searchLoader, false);

    // Add loading indicator if there are more results in the database and we got results this time
    if (res.length > 0 && currentSearchOffset < currentSearchTotal) {
      toggleElementVisibility(searchLoader, true);
    }
  } catch (e) {
    console.error("Search error", e);
    if (resetSearch) {
      entryListEl.textContent = "Search error";
    }
  } finally {
    isLoadingMore = false;
    toggleElementVisibility(searchLoader, false);
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
    toggleElementVisibility(searchLoader, true);
    if (mobileSearchResults) {
      mobileSearchResults.innerHTML = "";
    }
  }

  if (isLoadingMore) return;
  isLoadingMore = true;

  try {
    // Always query without whole-word restriction at DB layer; we'll filter client-side
    let response;
    const rawQuery = searchInput.value?.trim() ?? "";
    if (
      !rawQuery &&
      selectedTypeIds &&
      selectedTypeIds.size === 1 &&
      (Array.from(selectedTypeIds)[0] === "task" || Array.from(selectedTypeIds)[0] === "orb")
    ) {
      const type = Array.from(selectedTypeIds)[0];
      const convos = getConversationsByType(type, showHidden());
      response = { results: convos, total: convos.length };
    } else {
      response = getSearchResults(
        searchInput.value,
        searchResultLimit,
        currentSearchActorIds,
        true, // filterStartInput
        currentSearchOffset,
        currentSearchConvoIds, // conversationIds
        showHidden()
      );
    }
    const { results, total } = response;
    // Ensure global total reflects DB/query results for mobile as well
    setCurrentSearchTotal(total);
    // Append to raw results
    if (resetSearch) {
      currentSearchRawResults = [...results];
    } else {
      currentSearchRawResults = [...currentSearchRawResults, ...results];
    }

    toggleElementVisibility(searchLoader, false);

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
        toggleElementVisibility(mobileSearchCount, false);
        return;
      }

      // Render initial set
      mobileSearchResults.innerHTML = "";
      initialFiltered.forEach((r) => {
        const div = createSearchResultDiv(r, searchInput.value);
        div.addEventListener("click", () => {
          const cid = (r.conversationid);
          const eid = (r.id);

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
          const cid = (r.conversationid);
          const eid = (r.id);

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

    // Update header with current count: prefer DB total unless client-only whole-words filter is active
    if (wholeWordsCheckbox.checked && (searchInput.value || "").trim()) {
      setSearchCount(`Search Results (${currentSearchFilteredCount})`);
    } else {
      setSearchCount(`Search Results (${total})`);
    }

    // Update offset for next load (based on database results, not filtered)
    currentSearchOffset += results.length;

    // Add loading indicator if there are more results in the database and we got results this time
    if (results.length > 0 && currentSearchOffset < currentSearchTotal) {
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
    isLoadingMore = false;
    toggleElementVisibility(searchLoader, false);
  }
}
