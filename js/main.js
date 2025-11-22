// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from "./sqlLoader.js";
import * as DB from "./db.js";
import { buildTitleTree, renderTree } from "./treeBuilder.js";
import * as UI from "./ui.js";

const searchInput = UI.$("search");
const searchBtn = UI.$("searchBtn");
const actorFilter = UI.$("actorFilter");
const searchLoader = UI.$("searchLoader");
const convoListEl = UI.$("convoList");
const entryListEl = UI.$("entryList");
const entryListHeaderEl = UI.$("entryListHeader");
const entryDetailsEl = UI.$("entryDetails");
const entryOverviewEl = UI.$("entryOverview");
const currentEntryContainerEl = UI.$("currentEntryContainer");
const chatLogEl = UI.$("chatLog");
const backBtn = UI.$("backBtn");
const backStatus = UI.$("backStatus");
const moreDetailsEl = UI.$("moreDetails");

const minSearchLength = 3;
const searchResultLimit = 1000;

let navigationHistory = [];
let currentConvoId = null;
let currentEntryId = null;

async function boot() {
  const SQL = await loadSqlJs();
  await DB.initDatabase(SQL, "db/discobase.sqlite3");

  // load conversations & populate actor dropdown
  const convos = DB.getAllConversations();
  // filter dead-ends quickly
  const filtered = convos.filter((c) => !DB.isDeadEndConversation(c.id));
  // Build tree and render
  const tree = buildTitleTree(filtered);
  renderTree(convoListEl, tree);

  // event delegation: clicks in convoList
  convoListEl.addEventListener("click", (e) => {
    const target = e.target.closest("[data-convo-id]");
    if (target) {
      const id = parseInt(target.dataset.convoId, 10);
      loadEntriesForConversation(id);
      highlightConversationInTree(id);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const id = parseInt(topLabel.dataset.singleConvo, 10);
      loadEntriesForConversation(id);
    }
  });

  // actor dropdown
  populateActorDropdown();

  // wire search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () =>
      searchDialogues(searchInput.value)
    );
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") searchDialogues(searchInput.value);
    });
  }
  if (actorFilter)
    actorFilter.addEventListener("change", () => {
      if (searchInput.value) searchDialogues(searchInput.value);
    });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      goBack();
      updateBackButtonState();
    });
  }
  updateBackButtonState();

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener("toggle", async function () {
      if (moreDetailsEl.open && currentConvoId && currentEntryId) {
        await showEntryDetails(currentConvoId, currentEntryId);
      }
    });
  }
}

async function populateActorDropdown() {
  const actors = DB.getDistinctActors();
  actorFilter.innerHTML = `<option value="">All Actors</option>`;
  actors.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.id;
    opt.textContent = a.name;
    actorFilter.appendChild(opt);
  });
}
function highlightConversationInTree(convoID) {
  // Remove old highlights
  convoListEl.querySelectorAll(".label.selected")
    .forEach(el => el.classList.remove("selected"));

  // find the target label by numeric ID comparison
  let label = null;
  convoListEl.querySelectorAll("[data-convo-id]").forEach(el => {
    if (parseInt(el.dataset.convoId, 10) === convoID) {
      label = el;
    }
  });
  if (!label) {
    convoListEl.querySelectorAll("[data-single-convo]").forEach(el => {
      if (parseInt(el.dataset.singleConvo, 10) === convoID) {
        label = el;
      }
    });
  }
  if (!label) return;

  label.classList.add("selected");
  label.scrollIntoView({ block: "nearest" });

  // climb ancestors: expand nodes until reaching top
  let parent = label.closest(".node");
  while (parent) {
    parent.classList.add("expanded");
    const toggle = parent.querySelector(":scope > .label > .toggle");
    if (toggle) toggle.textContent = "▾";

    parent = parent.parentElement.closest(".node");
  }
}


/* Load entries listing for conversation */
function loadEntriesForConversation(convoID) {
  convoID = parseInt(convoID, 10);
  navigationHistory = [{ convoID, entryID: null }];
  if (currentEntryContainerEl) currentEntryContainerEl.style.display = "flex";
  const rows = DB.getEntriesForConversation(convoID);
  entryListHeaderEl.textContent = "Next Dialogue Options";
  entryListEl.innerHTML = "";
  const filtered = rows.filter(
    (r) => (r.title || "").toLowerCase() !== "start"
  );
  if (!filtered.length) {
    entryListEl.textContent = "(no meaningful entries - only START)";
    return;
  }
  filtered.forEach((r) => {
    const id = parseInt(r.id, 10);
    const title = r.title && r.title.trim() ? r.title : "(no title)";

    const text = r.dialoguetext || "";
    const el = UI.createCardItem(
      `${convoID}:${id}. ${title}`,
      text.substring(0, 300),
      false
    );
    el.addEventListener("click", () => navigateToEntry(convoID, id));
    entryListEl.appendChild(el);
  });
}

/* Navigation / history functions */
function updateBackButtonState() {
  if (!backBtn) return;
  backBtn.disabled = navigationHistory.length <= 1;
  if (backStatus) {
    backStatus.textContent =
      navigationHistory.length > 1 ? `(${navigationHistory.length} steps)` : "";
  }
}

function goBack() {
  if (navigationHistory.length <= 1) return;
  navigationHistory.pop();
  const previous = navigationHistory[navigationHistory.length - 1];
  if (previous && previous.entryID) {
    const cid = parseInt(previous.convoID, 10);
    const eid = parseInt(previous.entryID, 10);
    navigateToEntry(cid, eid, false);
  }
}

/* navigateToEntry optimized */
async function navigateToEntry(convoID, entryID, addToHistory = true) {
  // Ensure numeric IDs
  convoID = parseInt(convoID, 10);
  entryID = parseInt(entryID, 10);

  // Make visible
  if (currentEntryContainerEl)
    currentEntryContainerEl.style.visibility = "visible";

  // Highlight and expand conversation in tree
  highlightConversationInTree(convoID);

  // small cache first
  const cached = DB.getCachedEntry(convoID, entryID);
  if (addToHistory) navigationHistory.push({ convoID, entryID });
  updateBackButtonState();

  // Append chat log entry
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes("(navigation log")
    )
      chatLogEl.innerHTML = "";
    const historyIndex = navigationHistory.length - 1;
    const coreRow = DB.getEntry(convoID, entryID);
    const title = coreRow
      ? coreRow.title || "(no title)"
      : `(line ${convoID}:${entryID})`;
    const dialoguetext = coreRow ? coreRow.dialoguetext : "";
    const item = UI.appendHistoryItem(
      chatLogEl,
      `${title} — #${entryID}`,
      dialoguetext,
      historyIndex,
      () => {
        if (item.dataset.isCurrent === "true") return;
        jumpToHistoryPoint(historyIndex);
      }
    );
    // mark current
    const allItems = chatLogEl.querySelectorAll(".card-item");
    allItems.forEach((el) => {
      el.dataset.isCurrent = "false";
      el.style.opacity = "1";
      el.style.cursor = "pointer";
    });
    item.dataset.isCurrent = "true";
    item.style.opacity = "0.7";
    item.style.cursor = "default";

    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext);
  }

  currentConvoId = convoID;
  currentEntryId = entryID;

  // Load child links (parents/children) and render options
  // Use DB.getParentsChildren which is optimized
  try {
    entryListHeaderEl.textContent = "Next Dialogue Options";
    entryListEl.innerHTML = "";

    // get children via DB.getParentsChildren
    const { parents, children } = DB.getParentsChildren(convoID, entryID);

    // Build a list of destination pairs to fetch in batch, to avoid many queries
    const pairs = [];
    for (const c of children) pairs.push({ convo: c.d_convo, id: c.d_id });
    // But skip START entries when rendering
    const destRows = DB.getEntriesBulk(pairs);
    // Map by key
    const destMap = new Map(destRows.map((r) => [`${r.convo}:${r.id}`, r]));

    for (const c of children) {
      const dest = destMap.get(`${c.d_convo}:${c.d_id}`);
      if (!dest) continue;

      if ((dest.title || "").toLowerCase() === "start") continue;

      const title = dest.title?.trim() || "(no title)";
      const display = `${c.d_convo}:${c.d_id}. ${title}`;
      const summary = dest.dialoguetext?.substring(0, 200) || "";

      const el = UI.createCardItem(display, summary, false);
      el.addEventListener("click", () => navigateToEntry(c.d_convo, c.d_id));
      entryListEl.appendChild(el);
    }

    if (entryListEl.children.length === 0)
      entryListEl.textContent = "(no further options)";
  } catch (e) {
    console.error("Error loading child links", e);
    entryListEl.textContent = "(error loading next options)";
  }

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    await showEntryDetails(convoID, entryID);
  }
}

/* Show entry details (optimized) */
async function showEntryDetails(convoID, entryID) {
  if (!DB || !entryDetailsEl) return;

  // Check cache
  const cached = DB.getCachedEntry(convoID, entryID);
  if (cached) {
    UI.renderEntryDetails(entryDetailsEl, {
      ...cached,
      onNavigate: navigateToEntry,
    });
    return;
  }

  // core row
  const core = DB.getEntry(convoID, entryID);
  if (!core) {
    entryDetailsEl.textContent = "(not found)";
    return;
  }

  // Fetch alternates, checks, parents/children
  const alternates = core.hasalts > 0 ? DB.getAlternates(convoID, entryID) : [];
  const checks = core.hascheck > 0 ? DB.getChecks(convoID, entryID) : [];
  const { parents, children } = DB.getParentsChildren(convoID, entryID);

  // Optionally get conversation metadata (first row of dialogues)
  const convoRow =
    DB.execRows(
      `SELECT id, title, description, actor, conversant FROM dialogues WHERE id='${convoID}' LIMIT 1;`
    )[0] || {};
  // If actor ids present, get actor names
  let entryActorName = null;
  if (core.actor && core.actor !== 0) {
    const a = DB.execRows(
      `SELECT id, name FROM actors WHERE id='${core.actor}' LIMIT 1;`
    )[0];
    if (a) entryActorName = a.name;
  }
  let convoActorName = null;
  if (convoRow.actor && convoRow.actor !== 0) {
    const a2 = DB.execRows(
      `SELECT id, name FROM actors WHERE id='${convoRow.actor}' LIMIT 1;`
    )[0];
    if (a2) convoActorName = a2.name;
  }

  const payload = {
    convoID: convoID,
    entryID: entryID,
    title: core.title,
    actorID: core.actor,
    actorName: entryActorName,
    alternates,
    checks,
    parents,
    children,
    conversationTitle: convoRow.title,
    conversationDescription: convoRow.description,
    conversationActorId: convoRow.actor,
    conversationActorName: convoActorName,
    sequence: core.sequence,
    conditionstring: core.conditionstring,
    userscript: core.userscript,
    difficultypass: core.difficultypass,
    onNavigate: navigateToEntry,
  };

  // Cache it
  DB.cacheEntry(convoID, entryID, payload);

  UI.renderEntryDetails(entryDetailsEl, payload);
}

/* Search */
function searchDialogues(q) {
  if (searchLoader) searchLoader.style.display = "flex";
  try {
    const actorId = actorFilter?.value || null;
    const res = DB.searchDialogues(q, actorId, searchResultLimit);
    entryListHeaderEl.textContent = "Search Results";
    entryListEl.innerHTML = "";
    if (!res.length) {
      entryListEl.textContent = "(no matches)";
      entryListHeaderEl.textContent += " (0)";
      if (currentEntryContainerEl)
        currentEntryContainerEl.style.visibility = "collapse";
      return;
    }
    entryListHeaderEl.textContent += ` (${res.length})`;
    res.forEach((r) => {
      const highlightedTitle = UI.highlightTerms(
        `${r.conversationid}:${r.id}. ${r.title || "(no title)"}`,
        q
      );

      const highlightedText = UI.highlightTerms(r.dialoguetext || "", q);

      const div = UI.createCardItem(highlightedTitle, highlightedText, true);

      div.addEventListener("click", () => {
        const cid = parseInt(r.conversationid, 10);
        const eid = parseInt(r.id, 10);
        navigationHistory = [{ convoID: cid, entryID: null }];
        navigateToEntry(cid, eid);
      });
      entryListEl.appendChild(div);
    });
    if (currentEntryContainerEl)
      currentEntryContainerEl.style.visibility = "collapse";
  } catch (e) {
    console.error("Search error", e);
    entryListEl.textContent = "Search error";
  } finally {
    if (searchLoader) searchLoader.style.display = "none";
  }
}

function jumpToHistoryPoint(historyIndex) {
  if (historyIndex < 0 || historyIndex >= navigationHistory.length) return;
  navigationHistory = navigationHistory.slice(0, historyIndex + 1);
  const target = navigationHistory[historyIndex];
  if (target && target.entryID) {
    const cid = parseInt(target.convoID, 10);
    const eid = parseInt(target.entryID, 10);
    navigateToEntry(cid, eid, false);
  }
}

/* Initialize boot sequence */
boot().catch((err) => console.error("boot error", err));
