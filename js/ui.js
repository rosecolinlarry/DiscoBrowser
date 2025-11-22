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
  if (allowHtml) text.innerHTML = contentText || "";
  else text.textContent = contentText || "";

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
  hint.textContent = "(navigation log - click a line to begin)";
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
  item.className = "card-item";
  item.style.cursor = "pointer";
  item.dataset.historyIndex = historyIndex;
  const titleDiv = document.createElement("div");
  titleDiv.className = "card-title";
  titleDiv.textContent = title;
  const textDiv = document.createElement("div");
  textDiv.className = "card-text";
  textDiv.textContent = text || "";
  item.appendChild(titleDiv);
  item.appendChild(textDiv);
  if (onClick) item.addEventListener("click", onClick);
  chatLogEl.appendChild(item);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
  return item;
}

/* Add visual divider for new conversations in history */
export function appendHistoryDivider(chatLogEl, convoID = null) {
  const divider = document.createElement("div");
  divider.className = "history-divider";
  
  if (convoID) {
    divider.innerHTML = `<span style="cursor: pointer; opacity: 0.7;" title="Click to jump to this conversation">─── Conversation #${convoID} ───</span>`;
    const span = divider.querySelector("span");
    if (span) {
      span.addEventListener("click", () => {
        // Dispatch event to navigate to this conversation
        const event = new CustomEvent("navigateToConversation", {
          detail: { convoID },
          bubbles: true
        });
        chatLogEl.dispatchEvent(event);
      });
    }
  } else {
    divider.textContent = "─── New Conversation ───";
  }
  
  divider.style.textAlign = "center";
  divider.style.margin = "8px 0";
  divider.style.opacity = "0.6";
  divider.style.fontSize = "0.9em";
  divider.style.fontStyle = "italic";
  divider.style.color = "#999";
  chatLogEl.appendChild(divider);
}

/* Utility to render current entry summary */
export function renderCurrentEntry(entryOverviewEl, title, dialoguetext) {
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";
  entryOverviewEl.style.cursor = "pointer";
  entryOverviewEl.innerHTML = `<div class="current-item"><strong class="speaker">${parseSpeakerFromTitle(
    title
  )}</strong></div><div class="dialogue-text">${
    dialoguetext || "<i>No dialogue.</i>"
  }</div>`;
}

function parseSpeakerFromTitle(title) {
  if (!title) return "";
  const splitTitle = title.split(":");
  if (splitTitle.length > 1) return splitTitle[0].trim();
  return title;
}

/* Render details container - caller provides data */
export function renderEntryDetails(containerEl, data) {
  containerEl.innerHTML = "";
  const wrapper = document.createElement("div");

  const convoTitleDiv = document.createElement("div");
  convoTitleDiv.innerHTML = `<strong class="details-section-header">Title</strong> <span class="details-item">${
    data.title || "(no title)"
  } -- #${data.entryID}</span>`;
  wrapper.appendChild(convoTitleDiv);

  if (data.actorName) {
    const actorDiv = document.createElement("div");
    actorDiv.innerHTML = `<strong class="details-section-header">Actor</strong> <span class="details-item">${data.actorName} -- #${data.actorID}</span>`;
    wrapper.appendChild(actorDiv);
  }

  // Alternates
  if (data.alternates && data.alternates.length) {
    const altsDiv = document.createElement("div");
    altsDiv.innerHTML = `<div class="details-section-header">Alternates</div>`;
    const list = document.createElement("div");
    list.className = "details-list";
    data.alternates.forEach((a) => {
      const it = document.createElement("div");
      it.className = "details-item";
      it.innerHTML = `${a.alternateline} <span>(condition: ${a.condition})</span>`;
      list.appendChild(it);
    });
    altsDiv.appendChild(list);
    wrapper.appendChild(altsDiv);
  }

  // Checks
  if (data.checks && data.checks.length) {
    const cDiv = document.createElement("div");
    cDiv.innerHTML = `<div class="details-section-header">Checks</div>`;
    const table = document.createElement("table");
    table.className = "details-table";
    data.checks.forEach((ch) => {
      Object.entries(ch).forEach(([k, v]) => {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.textContent = k;
        const td = document.createElement("td");
        td.textContent = v === null || v === undefined ? "(none)" : String(v);
        tr.appendChild(th);
        tr.appendChild(td);
        table.appendChild(tr);
      });
    });
    cDiv.appendChild(table);
    wrapper.appendChild(cDiv);
  }

  // Parents
  const parentsDiv = document.createElement("div");
  parentsDiv.innerHTML = `<div class="details-section-header">Parents</div>`;
  const pList = document.createElement("div");
  pList.className = "details-list";
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
      meta.style.color = "#999";
      meta.style.fontSize = "11px";
      item.appendChild(meta);
      pList.appendChild(item);
    });
    parentsDiv.appendChild(pList);
  } else {
    const it = document.createElement("div");
    it.className = "details-item";
    it.textContent = "(none)";
    parentsDiv.appendChild(it);
  }
  wrapper.appendChild(parentsDiv);

  // Children
  const childrenDiv = document.createElement("div");
  childrenDiv.innerHTML = `<div class="details-section-header">Children</div>`;
  const cList = document.createElement("div");
  cList.className = "details-list";
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
      meta.style.color = "#999";
      meta.style.fontSize = "11px";
      item.appendChild(meta);
      cList.appendChild(item);
    });
    childrenDiv.appendChild(cList);
  } else {
    const it = document.createElement("div");
    it.className = "details-item";
    it.textContent = "(none)";
    childrenDiv.appendChild(it);
  }
  wrapper.appendChild(childrenDiv);

  // conversation & meta table
  const convoDiv = document.createElement("div");
  convoDiv.innerHTML = `<div class="details-section-header">Conversation</div>`;
  const t = document.createElement("table");
  t.className = "details-table";
  const rows = [
    ["ID", data.convoID || "(none)"],
    ["Title", data.conversationTitle || "(none)"],
    ["Description", data.conversationDescription || "(none)"],
    ["Actor ID", data.conversationActorId || "(none)"],
    ["Actor name", data.conversationActorName || "(none)"],
  ];
  rows.forEach(([label, val]) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = label;
    const td = document.createElement("td");
    td.textContent = val;
    tr.appendChild(th);
    tr.appendChild(td);
    t.appendChild(tr);
  });
  convoDiv.appendChild(t);
  wrapper.appendChild(convoDiv);

  // meta table
  const metaDiv = document.createElement("div");
  metaDiv.innerHTML = `<div class="details-section-header">Meta</div>`;
  const mt = document.createElement("table");
  mt.className = "details-table";
  [
    ["Sequence", data.sequence || "(none)"],
    ["Condition", data.conditionstring || "(none)"],
    ["Userscript", data.userscript || "(none)"],
    ["Difficulty", data.difficultypass || "(none)"],
  ].forEach(([lab, val]) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = lab;
    const td = document.createElement("td");
    td.textContent = val;
    tr.appendChild(th);
    tr.appendChild(td);
    mt.appendChild(tr);
  });
  metaDiv.appendChild(mt);
  wrapper.appendChild(metaDiv);

  containerEl.appendChild(wrapper);
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

  return escapeHtml(text).replace(re, "<strong>$1</strong>");
}
