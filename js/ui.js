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
  dialoguetext = getStringOrDefault(dialoguetext, "<i>No dialogue.</i>");
  title = getStringOrDefault(parseSpeakerFromTitle(title), "<i>No title.</i>");
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
  const description = getStringOrDefault(
    conversation.description,
    "<i>No conversation description.</i>"
  );

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

/* Render details container - caller provides data */
export function renderEntryDetails(containerEl, data) {
  containerEl.innerHTML = "";
  const wrapper = document.createElement("div");

  wrapper.appendChild(createEntryTable(data));
  wrapper.appendChild(createAlternatesList(data));
  wrapper.appendChild(createChecksList(data));
  wrapper.appendChild(createParentsList(data));
  wrapper.appendChild(createChildrenList(data));
  wrapper.appendChild(createConvoTable(data));
  wrapper.appendChild(createMetaTable(data));

  containerEl.appendChild(wrapper);
}

function createAlternatesList(data) {
  const listDiv = createDetailsSectionHeader("Alternates");
  const list = document.createElement("div");
  list.className = "details-list";
  if (data.alternates && data.alternates.length) {
    data.alternates.forEach((a) => {
      const item = document.createElement("div");
      item.className = "details-item";
      item.innerHTML = `${a.alternateline} <span>(condition: ${a.condition})</span>`;
      list.appendChild(item);
    });
    listDiv.appendChild(list);
  } else {
    listDiv.append(createPlaceholderItem());
  }

  return listDiv;
}

function createDetailsSectionHeader(sectionTitle) {
  const sectionHeader = document.createElement("div");
  sectionHeader.innerHTML = `<div class="details-section-header">${sectionTitle}</div>`;
  return sectionHeader;
}

function createPlaceholderItem() {
  const item = document.createElement("span");
  item.classList = "details-item details-item-placeholder";
  item.textContent = "(none)";
  return item;
}

function createChecksList(data) {
  const checksDiv = createDetailsSectionHeader("Checks");
  const checksList = document.createElement("div");
  checksList.className = "details-list";
  if (data.checks && data.checks.length) {
    data.checks.forEach((check) => {
      const item = document.createElement("div");
      item.className = "details-item";
      const checkText = document.createElement("span");
      checkText.textContent = getStringOrDefault(check);
      item.appendChild(checkText);
    });
    checksList.appendChild(item);
  } else {
    checksDiv.append(createPlaceholderItem());
  }
  return checksDiv;
}

function createParentsList(data) {
  // Parents
  const parentsDiv = createDetailsSectionHeader("Parents");
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
    parentsDiv.appendChild(createPlaceholderItem());
  }
  return parentsDiv;
}

function createChildrenList(data) {
  const childrenDiv = createDetailsSectionHeader("Children");
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
    childrenDiv.appendChild(createPlaceholderItem());
  }
  return childrenDiv;
}

function createEntryTable(data) {
  const tableDiv = createDetailsSectionHeader("Entry");
  const rows = [
    ["Entry Id", data.entryId],
    ["Entry Title", data.title],
    ["Entry Actor Id", data.actorId],
    ["Entry Actor Name", data.actorName],
  ];

  tableDiv.appendChild(buildTable(rows));
  return tableDiv;
}

function createConvoTable(data) {
  const tableDiv = createDetailsSectionHeader("Conversation");
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

  tableDiv.appendChild(buildTable(rows));
  return tableDiv;
}

function createMetaTable(data) {
  const tableDiv = createDetailsSectionHeader("Meta");
  const rows = [
    ["Sequence", data.sequence],
    ["Condition", data.conditionstring],
    ["Userscript", data.userscript],
    ["Difficulty", data.difficultypass],
  ];
  tableDiv.appendChild(buildTable(rows));
  return tableDiv;
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
export function getStringOrDefault(str, defaultValue = "") {
  if (str === null || str === undefined || str === 0) {
    return defaultValue;
  }
  if (String(str)?.trim() === "") {
    return defaultValue;
  }
  return str;
}

export function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

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
