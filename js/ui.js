// ui.js
// DOM helpers and UI wiring (history, chat log, entry render helpers)

export function $(sel) {
  return document.getElementById(sel);
}

export function createCardItem(titleText, contentText, allowHtml = false) {
  titleText = titleText ?? "";
  contentText = contentText ?? "";

  const el = document.createElement("div");
  el.className = "card-item";
  el.style.cursor = "pointer";

  const title = document.createElement("div");
  title.className = "card-title";
  if (allowHtml) title.innerHTML = titleText;
  else title.textContent = titleText;

  const text = document.createElement("div");
  text.className = "card-text";
  if (allowHtml) text.innerHTML = getStringOrDefault(contentText);
  else text.textContent = getStringOrDefault(contentText);

  el.appendChild(title);
  el.appendChild(text);
  return el;
}

/* Chat log/history helpers */
export function resetChatLog(chatLogEl) {
  if (!chatLogEl) return;
  chatLogEl.innerHTML = "";
  const hint = document.createElement("div");
  hint.className = "hint-text";
  hint.textContent = "(navigation log - select a conversation to begin)";
  chatLogEl.appendChild(hint);
}

export function appendHistoryItem(
  chatLogEl,
  title,
  text,
  historyIndex,
  onClick
) {
  const item = document.createElement("div");
  item.className = "card-item history-item";
  item.style.cursor = onClick ? "pointer" : "default";
  item.dataset.historyIndex = historyIndex;

  const titleDiv = document.createElement("div");
  titleDiv.className = "card-title";
  titleDiv.textContent = title;

  const textDiv = document.createElement("div");
  textDiv.className = "card-text";
  textDiv.textContent = getStringOrDefault(text);

  item.appendChild(titleDiv);
  item.appendChild(textDiv);

  if (onClick) item.addEventListener("click", onClick);
  chatLogEl.appendChild(item);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
  return item;
}

/* Utility to render current entry summary */
export function renderCurrentEntry(entryOverviewEl, title, dialoguetext) {
  dialoguetext = getStringOrDefault(dialoguetext,"<i>No dialogue.</i>");
  title = getStringOrDefault(parseSpeakerFromTitle(title),"<i>No title.</i>")
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";
  entryOverviewEl.innerHTML = `<div class="current-item"><strong class="speaker">${title}</strong></div>
    <div class="dialogue-text">${dialoguetext}</div>`;
}

/* Utility to render conversation metadata */
export function renderConversationOverview(entryOverviewEl, conversation) {
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";

  const title = getStringOrDefault(conversation.title, "(no title)");
  const description = getStringOrDefault(conversation.description,"<i>No conversation description.</i>");

  entryOverviewEl.innerHTML = `
    <div class="current-item">
      <strong class="speaker">Conversation #${conversation.id}</strong>
      <div>
        <strong>Title:</strong> ${title}</div>
      <div class="dialogue-text">${description}</div>
    </div>
  `;
}

export function parseSpeakerFromTitle(title) {
  if (!title) return "";
  const splitTitle = title.split(":");
  if (
    splitTitle.length > 1 &&
    !title.startsWith("Jump to") &&
    !title.startsWith("NewspaperEndgame")
  )
    return splitTitle[0].trim();
  return title;
}

export function buildTable(rows) {
  const t = document.createElement("table");
  t.className = "details-table";
  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = getStringOrDefault(label, "(none)");
    td.textContent = getStringOrDefault(value, "(none)");
    tr.appendChild(th);
    tr.appendChild(td);
    t.appendChild(tr);
  });
  return t;
}

/* Render details container - caller provides data */
export function renderEntryDetails(containerEl, data) {
  containerEl.innerHTML = "";
  const wrapper = document.createElement("div");

  const convoTitleDiv = document.createElement("div");
  convoTitleDiv.innerHTML = `<strong class="details-section-header">Title</strong> <span class="details-item">${getStringOrDefault(
    data.title,
    "(no title)"
  )} -- #${data.entryId}</span>`;
  wrapper.appendChild(convoTitleDiv);

  if (data.actorName) {
    const actorDiv = document.createElement("div");
    actorDiv.innerHTML = `<strong class="details-section-header">Actor</strong> <span class="details-item">${data.actorName} -- #${data.actorId}</span>`;
    wrapper.appendChild(actorDiv);
  }

  // Alternates
  if (data.alternates && data.alternates.length) {
    wrapper.appendChild(createAlternatesList(data));
  }

  if (data.checks && data.checks.length) {
    wrapper.appendChild(createChecksTable(data));
  }

  wrapper.appendChild(createParentsList(data));
  wrapper.appendChild(createChildrenList(data));
  wrapper.appendChild(createConvoTable(data));
  wrapper.appendChild(createMetaTable(data));

  containerEl.appendChild(wrapper);
}

function createAlternatesList(data) {
  const listDiv = document.createElement("div");
  listDiv.innerHTML = `<div class="details-section-header">Alternates</div>`;
  const list = document.createElement("div");
  list.className = "details-list";
  data.alternates.forEach((a) => {
    const it = document.createElement("div");
    it.className = "details-item";
    it.innerHTML = `${a.alternateline} <span>(condition: ${a.condition})</span>`;
    list.appendChild(it);
  });
  listDiv.appendChild(list);
  return listDiv;
}

function createChecksTable(data) {
  const tableDiv = document.createElement("div");
  tableDiv.innerHTML = `<div class="details-section-header">Checks</div>`;
  const rows = data.checks;
  const table = buildTable(rows);
  tableDiv.appendChild(table);
  return tableDiv;
}

// Create parents list
function createParentsList(data) {
  // Parents
  const parentsDiv = document.createElement("div");
  parentsDiv.innerHTML = `<div class="details-section-header">Parents</div>`;
  const parentsList = document.createElement("div");
  parentsList.className = "details-list";
  if (data.parents && data.parents.length) {
    data.parents.forEach((p) => {
      const item = document.createElement("div");
      item.className = "details-item";
      const a = document.createElement("a");
      a.textContent = `${p.o_convo}:${p.o_id}`;
      a.href = "#";
      a.dataset.convo = p.o_convo;
      a.dataset.id = p.o_id;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (data.onNavigate) data.onNavigate(p.o_convo, p.o_id);
      });
      item.appendChild(a);
      const meta = document.createElement("span");
      meta.textContent = ` (priority: ${p.priority}, connector: ${p.isConnector})`;
      item.appendChild(meta);
      parentsList.appendChild(item);
    });
    parentsDiv.appendChild(parentsList);
  } else {
    const item = document.createElement("div");
    item.className = "details-item";
    item.textContent = "(none)";
    parentsDiv.appendChild(item);
  }
  return parentsDiv;
}

// Create children list
function createChildrenList(data) {
  const childrenDiv = document.createElement("div");
  childrenDiv.innerHTML = `<div class="details-section-header">Children</div>`;
  const childrenList = document.createElement("div");
  childrenList.className = "details-list";
  if (data.children && data.children.length) {
    data.children.forEach((c) => {
      const item = document.createElement("div");
      item.className = "details-item";
      const a = document.createElement("a");
      a.textContent = `${c.d_convo}:${c.d_id}`;
      a.href = "#";
      a.dataset.convo = c.d_convo;
      a.dataset.id = c.d_id;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (data.onNavigate) data.onNavigate(c.d_convo, c.d_id);
      });
      item.appendChild(a);
      const meta = document.createElement("span");
      meta.textContent = ` (priority: ${c.priority}, connector: ${c.isConnector})`;
      item.appendChild(meta);
      childrenList.appendChild(item);
    });
    childrenDiv.appendChild(childrenList);
  } else {
    const it = document.createElement("div");
    it.className = "details-item";
    it.textContent = "(none)";
    childrenDiv.appendChild(it);
  }
  return childrenDiv;
}

// Create Conversation details table
function createConvoTable(data) {
  const tableDiv = document.createElement("div");
  tableDiv.innerHTML = `<div class="details-section-header">Conversation</div>`;
  const t = document.createElement("table");
  t.className = "details-table";
  const rows = [
    ["Id", data.convoId],
    ["Title", data.conversationTitle],
    ["Description", data.conversationDescription],
    ["Actor Id", data.conversationActorId],
    ["Actor name", data.conversationActorName],
    ["Conversant Id", data.conversationConversantId],
    ["Conversant name", data.conversationConversantName],
    ["Description", data.conversationDescription],
  ];

  const table = buildTable(rows);
  tableDiv.appendChild(table);
  return tableDiv;
}

// Create Meta details table
function createMetaTable(data) {
  const tableDiv = document.createElement("div");
  tableDiv.innerHTML = `<div class="details-section-header">Meta</div>`;
  const rows = [
    ["Sequence", data.sequence],
    ["Condition", data.conditionstring],
    ["Userscript", data.userscript],
    ["Difficulty", data.difficultypass],
  ];
  const table = buildTable(rows);
  tableDiv.appendChild(table);
  return tableDiv;
}

// Return string or default value if it is null/whitespace/0
export function getStringOrDefault(str, defaultValue = "") {
  if (str === null || str === undefined || str === 0) {
    return defaultValue;
  }
  if (String(str)?.trim() === "") {
    return defaultValue;
  }
  return str;
}

// Escape HTML entities
export function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

// Bold-match highlighter: safe HTML output
export function highlightTerms(text, query) {
  if (!text || !query) return escapeHtml(text || "");

  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (!terms.length) return escapeHtml(text);

  // Escape terms for regex
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  // Regex: match any term (case-insensitive)
  const re = new RegExp("(" + escaped.join("|") + ")", "gi");

  return escapeHtml(text).replace(
    re,
    "<strong class='highlighted_term'>$1</strong>"
  );
}
