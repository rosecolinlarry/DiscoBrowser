// ui.js
// DOM helpers and UI wiring (history, chat log, entry render helpers)

export function $(sel) {
  return document.getElementById(sel);
}

export function createCardItem(titleText, convoId, entryId, contentText, allowHtml = false) {
  convoId = getParsedIntOrDefault(convoId, null)
  entryId = getParsedIntOrDefault(entryId, null)
  const titleId = `${convoId || ""}:${entryId || ""}`
  titleText = parseSpeakerFromTitle(getStringOrDefault(titleText))
  titleText = `${titleId} ${titleText}`
  contentText = getStringOrDefault(contentText)

  const el = document.createElement("div");
  el.className = "card-item";
  el.style.cursor = "pointer";

  const title = document.createElement("div");
  title.className = "card-title";
  if (allowHtml) title.innerHTML = titleText;
  else title.textContent = titleText;

  const text = document.createElement("div");
  text.className = "card-text";
  if (allowHtml) text.innerHTML = contentText;
  else text.textContent = contentText;

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

export function renderCurrentEntry(entryOverviewEl, title, dialoguetext) {
  dialoguetext = getStringOrDefault(dialoguetext, "<i>No dialogue.</i>");
  title = getStringOrDefault(parseSpeakerFromTitle(title), "<i>No title.</i>");
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";
  entryOverviewEl.innerHTML = `<div class="current-item"><strong class="speaker">${title}</strong></div>
    <div class="dialogue-text">${dialoguetext}</div>`;
}


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

export function renderEntryDetails(containerEl, data) {
  containerEl.innerHTML = "";
  const wrapper = document.createElement("div");

  wrapper.appendChild(createEntryTable(data));
  if (data?.checks?.length) wrapper.appendChild(createChecksList(data.checks));
  if (data?.parents?.length) wrapper.appendChild(createParentsList(data.parents));
  if (data?.children.length) wrapper.appendChild(createChildrenList(data.children));
  wrapper.appendChild(createConvoTable(data));
  if (data?.alternates.length) wrapper.appendChild(createAlternatesList(data.alternates));
  wrapper.appendChild(createMetaTable(data));

  containerEl.appendChild(wrapper);
}

function createAlternatesList(alternates) {
  const section = createDetailsSectionHeader("Alternates");
  const list = document.createElement("div");
  list.className = "details-list";
  if (alternates && alternates.length) {
    alternates.forEach((a) => {
      const item = document.createElement("div");
      item.className = "details-item";
      item.innerHTML = `${a.alternateline} <span>(condition: ${a.condition})</span>`;
      list.appendChild(item);
    });
    section.appendChild(list);
  } else {
    section.append(createPlaceholderItem());
  }

  return section;
}

function createChecksList(checks) {
  const section = createDetailsSectionHeader("Checks");
  const list = document.createElement("div");
  list.className = "details-list";
  if (checks && checks.length) {
    checks.forEach((check) => {
      const item = document.createElement("div");
      item.className = "details-item";
      const checkText = document.createElement("span");
      checkText.textContent = getStringOrDefault(check);
      item.appendChild(checkText);
    });
    list.appendChild(item);
  } else {
    section.append(createPlaceholderItem());
  }
  return section;
}

function createParentsList(parents) {
  // Parents
  const section = createDetailsSectionHeader("Parents");
  const list = document.createElement("div");
  list.className = "details-list";
  if (parents && parents.length) {
    parents.forEach((p) => {
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
      list.appendChild(item);
    });
    section.appendChild(list);
  } else {
    section.appendChild(createPlaceholderItem());
  }
  return section;
}

function createChildrenList(children) {
  const section = createDetailsSectionHeader("Children");
  const list = document.createElement("div");
  list.className = "details-list";
  if (children && children.length) {
    children.forEach((c) => {
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
      list.appendChild(item);
    });
    section.appendChild(list);
  } else {
    section.appendChild(createPlaceholderItem());
  }
  return section;
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
  const section = createDetailsSectionHeader("Conversation");
  const rows = [
    ["Conversation Id", data.convoId],
    ["Conversation Title", data.conversationTitle],
    ["Description", data.conversationDescription],
    ["Actor Id", data.conversationActorId],
    ["Actor name", data.conversationActorName],
    ["Conversant Id", data.conversationConversantId],
    ["Conversant name", data.conversationConversantName],
  ];

  section.appendChild(buildTable(rows));
  return section;
}

function createMetaTable(data) {
  const section = createDetailsSectionHeader("Meta");
  const rows = [
    ["Sequence", data.sequence],
    ["Condition", data.conditionstring],
    ["Userscript", data.userscript],
    ["Difficulty", data.difficultypass],
  ];
  section.appendChild(buildTable(rows));
  return section;
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

function buildTable(rows) {
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

export function getParsedIntOrDefault(value, defaultValue = null) {
  const parsedValue = parseInt(value, 10);
  return isNaN(parsedValue) ? defaultValue : parsedValue;
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
