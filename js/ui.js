// ui.js
// DOM helpers and UI wiring (history, chat log, entry render helpers)

export function $(sel) {
  return document.getElementById(sel);
}

// Make external links open in new tabs
function processExternalLinks(element) {
  const links = element.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    // Check if it's an external link (starts with http/https and not #)
    if (href && (href.startsWith('http://') || href.startsWith('https://')) && !href.startsWith('#')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function createCardItem(titleText, convoId, entryId, contentText, allowHtml = false, convoType = null) {
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
  
  // Create title text span
  const titleSpan = document.createElement("span");
  if (allowHtml) titleSpan.innerHTML = titleText;
  else titleSpan.textContent = titleText;
  title.appendChild(titleSpan);
  
  // Add type badge if provided (right-aligned)
  if (convoType && convoType !== 'flow') {
    const badge = document.createElement("span");
    badge.className = `type-badge type-${convoType}`;
    badge.textContent = convoType;
    title.appendChild(badge);
  }

  const text = document.createElement("div");
  text.className = "card-text";
  if (allowHtml) {
    text.innerHTML = contentText;
    processExternalLinks(text);
  } else {
    text.textContent = contentText;
  }

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
  onClick,
  tabletChatLogEl = null
) {
  const item = document.createElement("div");
  item.className = "card-item history-item";
  
  // If no onClick handler, this is the current (non-clickable) entry
  if (!onClick) {
    item.classList.add("current-entry");
    item.style.cursor = "default";
  } else {
    item.style.cursor = "pointer";
  }
  
  item.dataset.historyIndex = historyIndex;

  const titleDiv = document.createElement("div");
  titleDiv.className = "card-title";
  titleDiv.innerHTML = `<span>${title}</span>`;

  const textDiv = document.createElement("div");
  textDiv.className = "card-text";
  textDiv.textContent = getStringOrDefault(text);

  item.appendChild(titleDiv);
  item.appendChild(textDiv);

  if (onClick) item.addEventListener("click", onClick);
  chatLogEl.appendChild(item);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
  
  // Also add to tablet chat log if provided
  if (tabletChatLogEl) {
    const tabletItem = item.cloneNode(true);
    if (onClick) tabletItem.addEventListener("click", onClick);
    tabletChatLogEl.appendChild(tabletItem);
    tabletChatLogEl.scrollTop = tabletChatLogEl.scrollHeight;
  }
  
  return item;
}

export function renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType = 'flow') {
  dialoguetext = getStringOrDefault(dialoguetext, "<i>No dialogue.</i>");
  title = getStringOrDefault(parseSpeakerFromTitle(title), "<i>No title.</i>");
  
  const typeBadge = convoType !== 'flow' 
    ? `<span class="type-badge type-${convoType}">${convoType.toUpperCase()}</span>` 
    : '';
  
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";
  entryOverviewEl.innerHTML = `<div class="current-item"><strong class="speaker">${title}</strong>${typeBadge}</div>
    <div class="dialogue-text">${dialoguetext}</div>`;
  processExternalLinks(entryOverviewEl);
}


export function renderConversationOverview(entryOverviewEl, conversation) {
  entryOverviewEl.innerHTML = "";
  entryOverviewEl.className = "entry-item current-item";

  const title = getStringOrDefault(conversation.title, "(no title)");
  const description = getStringOrDefault(
    conversation.description,
    "<i>No conversation description.</i>"
  );
  const convoType = conversation.type || 'flow';
  const typeBadge = convoType !== 'flow' 
    ? `<span class="type-badge type-${convoType}">${convoType.toUpperCase()}</span>` 
    : '';

  entryOverviewEl.innerHTML = `
    <div class="current-item">
      <strong class="speaker">Conversation #${conversation.id}</strong>${typeBadge}
      <div>
        <strong>Title:</strong> ${title}</div>
      <div class="dialogue-text">${description}</div>
    </div>`;
  processExternalLinks(entryOverviewEl);
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
  if (data?.parents?.length) wrapper.appendChild(createParentsList(data.parents, data));
  if (data?.children.length) wrapper.appendChild(createChildrenList(data.children, data));
  wrapper.appendChild(createConvoTable(data));
  
  // If viewing an alternate, show original line; otherwise show alternates list
  if (data.selectedAlternateCondition && data.originalDialogueText) {
    wrapper.appendChild(createOriginalLineSection(data));
  } else if (data?.alternates.length) {
    wrapper.appendChild(createAlternatesList(data.alternates, data));
  }
  
  wrapper.appendChild(createMetaTable(data));

  containerEl.appendChild(wrapper);
}

function createAlternatesList(alternates, data) {
  const section = createDetailsSectionHeader("Alternates");
  const list = document.createElement("div");
  list.className = "details-list";
  if (alternates && alternates.length) {
    alternates.forEach((a) => {
      const item = document.createElement("div");
      item.className = "details-item";
      
      // Create clickable link for the alternate
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = a.alternateline;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (data.onNavigate) {
          // Don't add to history when switching to alternate view
          data.onNavigate(a.conversationid, a.dialogueid, false, a.condition, a.alternateline);
        }
      });
      
      item.appendChild(link);
      const conditionSpan = document.createElement("span");
      conditionSpan.textContent = ` (condition: ${a.condition})`;
      item.appendChild(conditionSpan);
      list.appendChild(item);
    });
    section.appendChild(list);
  } else {
    section.append(createPlaceholderItem());
  }

  return section;
}

function createOriginalLineSection(data) {
  const section = createDetailsSectionHeader("Original Line");
  const list = document.createElement("div");
  list.className = "details-list";
  
  const item = document.createElement("div");
  item.className = "details-item";
  
  // Create clickable link to view the original
  const link = document.createElement("a");
  link.href = "#";
  link.textContent = data.originalDialogueText;
  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (data.onNavigate) {
      // Don't add to history when switching back to original view
      data.onNavigate(data.convoId, data.entryId, false, null, null);
    }
  });
  
  item.appendChild(link);
  list.appendChild(item);
  section.appendChild(list);
  
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

function createParentsList(parents, data) {
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

function createChildrenList(children, data) {
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
  
  // Combine entry condition and alternate condition if both exist
  let combinedCondition = data.conditionstring || "";
  if (data.selectedAlternateCondition) {
    if (combinedCondition) {
      combinedCondition = `${combinedCondition} AND ${data.selectedAlternateCondition}`;
    } else {
      combinedCondition = data.selectedAlternateCondition;
    }
  }
  
  const rows = [
    ["Sequence", data.sequence],
    ["Condition", combinedCondition],
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

export function highlightTerms(text, query, hasQuotedPhrases = false) {
  if (!text || !query) return escapeHtml(text || "");

  const trimmedQuery = query.trim();
  
  // If query has quoted phrases, extract them and remaining words
  if (hasQuotedPhrases) {
    // Extract all quoted phrases
    const quotedPhrases = [];
    const quotedPhrasesRegex = /"([^"]+)"/g;
    let match;
    while ((match = quotedPhrasesRegex.exec(trimmedQuery)) !== null) {
      quotedPhrases.push(match[1]);
    }
    
    // Remove quoted phrases from query to get remaining words
    const remainingText = trimmedQuery.replace(/"[^"]+"/g, '').trim();
    const words = remainingText ? remainingText.split(/\s+/).filter(w => w.length >= 3) : [];
    
    // Combine phrases and words for highlighting
    const allTerms = [...quotedPhrases, ...words];
    
    if (allTerms.length === 0) return escapeHtml(text);
    
    // Escape terms for regex - sort by length (longest first) to match longer phrases first
    const escaped = allTerms
      .sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    
    // Create regex to match any term
    const re = new RegExp("(" + escaped.join("|") + ")", "gi");
    
    // Split text by matches
    const parts = text.split(re);
    
    // Escape HTML and wrap matches in <strong> tags
    return parts.map(part => {
      // Check if this part matches any of the terms (case-insensitive)
      const isMatch = allTerms.some(term => part.toLowerCase() === term.toLowerCase());
      if (isMatch) {
        return "<strong class='highlighted_term'>" + escapeHtml(part) + "</strong>";
      }
      return escapeHtml(part);
    }).join("");
  }

  // For multi-word searches without quotes, split and highlight each word individually
  const terms = trimmedQuery
    .split(/\s+/)
    .filter((t) => t.length >= 3); // Match the minLength filter from search

  if (!terms.length) return escapeHtml(text);

  // Escape terms for regex
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  // Regex: match any term (case-insensitive)
  const re = new RegExp("(" + escaped.join("|") + ")", "gi");

  // Split text by matches to preserve both matched and unmatched parts
  const parts = text.split(re);
  
  // Escape HTML and wrap matches in <strong> tags
  return parts.map((part, i) => {
    // Check if this part matches any of the search terms (case-insensitive)
    const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
    if (isMatch) {
      return "<strong class='highlighted_term'>" + escapeHtml(part) + "</strong>";
    }
    return escapeHtml(part);
  }).join("");
}
