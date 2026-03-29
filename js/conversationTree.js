import { setToggleIcon } from "./iconHelpers.js";
import { loadEntriesForConversation } from "./loadEntriesForConversation.js";
import {
  getCurrentConvoId,
  handleNavigateToConvoLeaf,
  handleConvoLabelClick,
} from "./navigation.js";
import { getAllConversations, getConversationById } from "./sqlHelpers.js";
import { $, highlightTerms } from "./uiHelpers.js";
import { showHidden } from "./userSettings.js";

const convoSearchInput = $("convoSearchInput");
const convoIdSearchInput= $("convoIdSearchInput");
const convoListEl = $("convoList");
const convoTypeFilterBtns = document.querySelectorAll(
  ".radio-button-group .radio-button"
);
// Tree control elements
const expandAllBtn = $("expandAllBtn");
const collapseAllBtn = $("collapseAllBtn");

let convos = [];
let activeTypeFilter = "all";
let conversationTree = null;

export function rebuildConversationTree() {
  // Rebuild tree to reflect hidden/title settings. Used in userSettings.js only
  initializeConversationsForTree();
  conversationTree = buildTitleTree(convos);
  renderTree(convoListEl, conversationTree);
  if (getCurrentConvoId() !== null) {
    highlightConversationInTree(getCurrentConvoId());
  }
}
export function highlightConversationInTree(convoId) {
  // Remove highlight from all labels (both leaf and node labels). Also used in navigation.js
  const allLabels = convoListEl.querySelectorAll(".label.selected");
  allLabels.forEach((label) => {
    label.classList.remove("selected");
  });

  // Find the leaf with data-convo-id
  let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoId}"]`);

  if (leafLabel) {
    // Highlight the leaf label itself and walk up the tree and expand all ancestor nodes
    let node = leafLabel.closest(".node").querySelector(".label");
    node.classList.add("selected");
    node.scrollIntoView();

    // Move up one level
    node = node.parentElement.parentElement.closest(".node");
    while (node) {
      node.classList.add("expanded");
      // Update toggle text
      const toggle = node.querySelector(":scope > .label > .toggle");
      if (toggle) {
        setToggleIcon(toggle, true);
      }

      // Move up one level
      node = node.parentElement?.closest(".node");
    }
  }
}
export function getConvos() {
  return convos;
}
export function buildConvoTreeAndRender() {
  // Used in boot
  initializeConversationsForTree();
  conversationTree = buildTitleTree(convos);
  renderTree(convoListEl, conversationTree);
  setUpConversationListEvents();
  setupConversationFilter();
}

function updateTreeControlButtons(enableButtons) {
  if (expandAllBtn) {
    expandAllBtn.disabled = !enableButtons;
  }
  if (collapseAllBtn) {
    collapseAllBtn.disabled = !enableButtons;
  }
}
function expandAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    const toggle = node.querySelector(".toggle");
    if (
      toggle &&
      toggle.dataset.canToggle === "true" &&
      !node.classList.contains("expanded")
    ) {
      node.classList.add("expanded");
      setToggleIcon(toggle, true);
    }
  });
}
function collapseAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll(".node");
  allNodes.forEach((node) => {
    if (node.classList.contains("expanded")) {
      const toggle = node.querySelector(".toggle");
      node.classList.remove("expanded");
      if (toggle && toggle.dataset.canToggle === "true") {
        setToggleIcon(toggle, false);
      }
    }
  });
}
function filterConversationTree() {
  let searchText;
  let searchId;
  if (!conversationTree) return;
  searchText = convoSearchInput?.value?.toLowerCase().trim() ?? "";
  searchId = parseInt(convoIdSearchInput?.value?.toLowerCase().trim() ?? "");
  // If no text search is active
  if (!searchText && !searchId) {
    // Show full tree when all types selected
    if (activeTypeFilter === "all") {
      renderTree(convoListEl, conversationTree);
      updateTreeControlButtons(true);
      if (getCurrentConvoId() !== null) {
        highlightConversationInTree(getCurrentConvoId());
      }
      return;
    }

    // Build a filtered tree for the selected type
    const { convoTitleById, convoTypeById } = conversationTree;
    const filteredRows = Object.keys(convoTitleById)
      .map((idStr) => {
        const id = Number(idStr);
        return {
          id,
          title: convoTitleById[id],
          type: convoTypeById[id] || "flow",
        };
      })
      .filter((row) => row.type === activeTypeFilter);

    if (filteredRows.length === 0) {
      convoListEl.innerHTML = "(no conversations for selected type)";
      updateTreeControlButtons(false);
      return;
    }

    const filteredTree = buildTitleTree(filteredRows);
    renderTree(convoListEl, filteredTree);
    updateTreeControlButtons(true);
    if (getCurrentConvoId() !== null) {
      highlightConversationInTree(getCurrentConvoId());
    }
    return;
  }

  // Get all matching conversation leaves
  const matches = [];
  collectMatchingLeaves(
    conversationTree.root,
    searchText,
    searchId,
    activeTypeFilter,
    matches,
    conversationTree,
  );

  // Clear and render matching results directly as a flat list
  convoListEl.innerHTML = "";
  updateTreeControlButtons(false);

  if (matches.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "hint-text";
    noResults.textContent = "No matching conversations found.";
    convoListEl.appendChild(noResults);
    return;
  }

  // Render each match as a leaf item
  matches.forEach((match) => {
    const item = createFilteredLeafItem(match, searchText);
    convoListEl.appendChild(item);
  });
}
function collectMatchingLeaves(node, searchText, searchId, typeFilter, matches, tree) {
  // Check if this node has conversation IDs
  if (node.convoIds && node.convoIds.length > 0) {
    node.convoIds.forEach((cid) => {
      const convo = getConversationById(cid);
      if (!convo) return;

      // Type filter
      if (typeFilter !== "all" && convo.type !== typeFilter) {
        return;
      }

      // Id filter
      if(searchId && searchId !== null && !isNaN(searchId)) {
        const idMatch = cid == searchId;
        if(idMatch) {
          matches.push({
            convoId: cid,
            title: convo.title,
            type: convo.type || "flow",
          });
        }
      }
      // Text filter
      else if (searchText) {
        const titleMatch = convo.title.toLowerCase().includes(searchText);
        if (titleMatch) {
          matches.push({
            convoId: cid,
            title: convo.title,
            type: convo.type || "flow",
          });
        }
      } else {
        matches.push({
          convoId: cid,
          title: convo.title,
          type: convo.type || "flow",
        });
      }
    });
  }

  // Recursively search children
  if (node.children) {
    for (const child of node.children.values()) {
      collectMatchingLeaves(child, searchText, searchId, typeFilter, matches, tree);
    }
  }
}
function createFilteredLeafItem(match, searchText) {
  // Filter the conversation tree by text and create the results as leaves
  const wrapper = document.createElement("div");
  wrapper.className = "node leaf-result";

  const label = document.createElement("div");
  label.className = "label";
  label.dataset.convoId = match?.convoId;

  // No toggle for leaf items
  const toggle = document.createElement("span");
  toggle.className = "toggle";
  label.appendChild(toggle);

  const titleSpan = document.createElement("span");

  // Highlight matching text (supports quoted phrases and multi-word queries)
  if (searchText) {
    const hasQuotedPhrases = /"[^"]+"/g.test(searchText);
    titleSpan.innerHTML = highlightTerms(
      match?.title || "",
      searchText,
      hasQuotedPhrases,
    );
  } else {
    titleSpan.textContent = match?.title;
  }

  // Append convo ID without overwriting HTML
  const titleText = titleSpan.textContent || match?.title || "";
  if (!titleText.endsWith(` #${label.dataset.convoId}`)) {
    const idNode = document.createTextNode(` #${label.dataset.convoId}`);
    titleSpan.appendChild(idNode);
  }
  label.appendChild(titleSpan);

  // Add type badge
  if (match?.type !== "flow") {
    const badge = document.createElement("span");
    badge.className = `type-badge type-${match?.type}`;
    badge.textContent = match?.type?.toUpperCase();
    label.appendChild(badge);
  }

  // Apply highlight class based on type
  if (match?.type !== "flow") {
    label.classList.add(`highlight-${match?.type}`);
  }

  wrapper.appendChild(label);

  // Click handler to load conversation
  label.addEventListener("click", handleConvoLabelClick);

  return wrapper;
}
function buildTitleTree(convos) {
  const root = { children: new Map(), convoIds: [] };
  const convoTitleById = Object.create(null);
  const convoTypeById = Object.create(null);
  convos.forEach((r) => {
    const id = r.id;
    const raw = (r.title || `(id ${id})`).trim();
    convoTitleById[id] = raw;
    convoTypeById[id] = r.type || "flow";
    const parts = raw.split("/").map((p) => p.trim());
    if (!parts.length) parts.push(raw);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part))
        node.children.set(part, { children: new Map(), convoIds: [] });
      node = node.children.get(part);
      if (i === parts.length - 1) node.convoIds.push(id);
    }
  });
  // compute sizes iteratively using a stack
  collapseTree(root);
  computeSizesIterative(root);
  return { root, convoTitleById, convoTypeById };
}
function collapseTree(root) {
  // iterate each top-level key
  for (const [key, child] of [...root.children.entries()]) {
    const collapsed = collapseNode(child, key);
    // If collapse changed the node, update the parent map
    if (collapsed.newKey !== key) {
      root.children.delete(key);
      root.children.set(collapsed.newKey, collapsed.node);
    }
  }
}
function collapseNode(node, key) {
  let current = node;
  let currentKey = key;

  // collapse chain: keep collapsing while this node has:
  // - either: 1 child + no convoIds (intermediate node)
  // - or: 1 convoId + no children (leaf node that's an only child)
  while (
    (current.children.size === 1 && current.convoIds.length === 0) ||
    (current.convoIds.length === 1 && current.children.size === 0)
  ) {
    // case 1: has one child node, no leaves
    if (current.children.size === 1 && current.convoIds.length === 0) {
      const [childKey, childNode] = current.children.entries().next().value;
      current = childNode;
      currentKey = currentKey + " / " + childKey;
    }

    // case 2: has one leaf (convoId), no children - just append to key and stop
    else if (current.convoIds.length === 1 && current.children.size === 0) {
      currentKey = currentKey + " #" + current.convoIds[0];
      break;
    }
  }

  // recursively collapse deeper children
  for (const [childKey, childNode] of [...current.children.entries()]) {
    const collapsed = collapseNode(childNode, childKey);
    if (collapsed.newKey !== childKey) {
      current.children.delete(childKey);
      current.children.set(collapsed.newKey, collapsed.node);
    }
  }

  return { node: current, newKey: currentKey };
}
function computeSizesIterative(root) {
  // Post-order traversal using stack
  const stack = [{ node: root, visited: false }];
  while (stack.length) {
    const top = stack.pop();
    if (!top.visited) {
      stack.push({ node: top.node, visited: true });
      for (const child of top.node.children.values()) {
        stack.push({ node: child, visited: false });
      }
    } else {
      let count = (top.node.convoIds && top.node.convoIds.length) || 0;
      for (const child of top.node.children.values()) {
        count += child._subtreeSize || 0;
      }
      top.node._subtreeSize = count;
    }
  }
}
function collectTypesInSubtree(nodeObj) {
  // Helper function to collect all types in a subtree
  const types = new Set();

  // Add types from direct convoIds
  if (nodeObj.convoIds && nodeObj.convoIds.length > 0) {
    nodeObj.convoIds.forEach((id) => {
      const type = window._convoTypeById[id] || "flow";
      types.add(type);
    });
  }

  // Recursively collect from children
  if (nodeObj.children && nodeObj.children.size > 0) {
    for (const childNode of nodeObj.children.values()) {
      const childTypes = collectTypesInSubtree(childNode);
      childTypes.forEach((t) => types.add(t));
    }
  }

  return types;
}
function getDominantType(typesSet) {
  // Helper function to get the dominant/primary type for highlighting
  // Priority order: orb > task > flow
  if (typesSet.has("orb")) return "orb";
  if (typesSet.has("task")) return "task";
  return "flow";
}
function makeNodeElement(name, nodeObj) {
  const wrapper = document.createElement("div");
  wrapper.className = "node"; // Not expanded by default

  const label = document.createElement("div");
  label.className = "label";

  // Check if this node contains a collapsed conversation leaf
  const hasCollapsedLeaf =
    nodeObj.children.size === 0 && nodeObj.convoIds.length === 1;

  const toggle = document.createElement("span");
  toggle.className = "toggle";
  const shouldShowToggle = nodeObj._subtreeSize > 1 && !hasCollapsedLeaf;
  toggle.dataset.canToggle = shouldShowToggle ? "true" : "false";
  if (shouldShowToggle) {
    setToggleIcon(toggle, false);
  }
  label.appendChild(toggle);

  const titleSpan = document.createElement("span");
  titleSpan.className = "tree-title";
  titleSpan.textContent = name;
  titleSpan.title = name;
  label.appendChild(titleSpan);

  // Determine the type(s) for this node and apply highlighting
  let dominantType = "flow";

  // Add type badge only for collapsed leaf nodes (actual conversations)
  if (hasCollapsedLeaf && nodeObj.convoIds.length === 1) {
    // For collapsed leaf nodes, show the single conversation type
    const convoId = nodeObj.convoIds[0];
    const convoType = window._convoTypeById[convoId] || "flow";
    dominantType = convoType;

    if (convoType !== "flow") {
      const badge = document.createElement("span");
      badge.className = `type-badge type-${convoType}`;
      badge.textContent = convoType.toUpperCase();
      label.appendChild(badge);
    }
  } else if (nodeObj.children.size > 0 || nodeObj.convoIds.length > 1) {
    // For parent nodes, determine dominant type for highlighting but don't show badges
    const typesInSubtree = collectTypesInSubtree(nodeObj);
    dominantType = getDominantType(typesInSubtree);
  }

  // Apply highlight class to label based on dominant type
  if (dominantType !== "flow") {
    label.classList.add(`highlight-${dominantType}`);
  }

  wrapper.appendChild(label);

  const childrenContainer = document.createElement("div");
  childrenContainer.className = "children";
  wrapper.appendChild(childrenContainer);

  // store a reference
  wrapper._nodeObj = nodeObj;
  wrapper._childrenRendered = false;

  // Render children immediately but keep collapsed
  renderChildrenInto(nodeObj, childrenContainer, window._convoTitleById);
  wrapper._childrenRendered = true;

  // click handler: navigate if leaf, or toggle expand
  label.addEventListener("click", handleConvoLabelClick);

  return wrapper;
}
function getLastSegment(fullTitle) {
  // Helper to extract final segment from full title path
  // Check if the title ends with #<id> pattern
  const hashMatch = fullTitle.match(/(.*?)\s*#(\d+)$/);
  if (hashMatch) {
    // Return just the #id part
    return `#${hashMatch[2]}`;
  }

  // Otherwise use the old logic
  const parts = fullTitle
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || fullTitle;
}
function renderChildrenInto(nodeObj, containerEl, titleMap) {
  containerEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  // Render all conversation leaves
  if (nodeObj.convoIds && nodeObj.convoIds.length) {
    const convos = nodeObj.convoIds;
    for (let i = 0; i < convos.length; i++) {
      const cid = convos[i];
      const leaf = document.createElement("div");
      leaf.className = "leaf";
      const leafLabel = document.createElement("div");
      leafLabel.className = "label";
      leafLabel.setAttribute("data-convo-id", String(cid));
      leafLabel.dataset.singleConvo = cid;
      leafLabel.dataset.convoId = cid;
      leafLabel.style.cursor = "pointer";
      const fullTitle = titleMap[cid] || `(id ${cid})`;
      const finalSegment = getLastSegment(fullTitle);

      // Wrap title text in a span for ellipsis overflow
      const titleSpan = document.createElement("span");
      titleSpan.className = "tree-title";
      titleSpan.textContent = finalSegment;
      if (!titleSpan.textContent.endsWith(` #${cid}`)) {
        titleSpan.textContent += ` #${cid}`;
      }
      leafLabel.appendChild(titleSpan);

      // Add type badge and highlight for conversation leaves
      const convoType = window._convoTypeById[cid] || "flow";
      if (convoType !== "flow") {
        const badge = document.createElement("span");
        badge.className = `type-badge type-${convoType}`;
        badge.textContent = convoType.toUpperCase();
        leafLabel.appendChild(badge);

        // Add highlight class
        leafLabel.classList.add(`highlight-${convoType}`);
      }

      leaf.appendChild(leafLabel);
      frag.appendChild(leaf);
    }
  }

  // Render all child nodes
  const keys = Array.from(nodeObj.children.keys()).sort((a, b) =>
    a.localeCompare(b),
  );
  for (const k of keys) {
    const childNode = nodeObj.children.get(k);
    const nodeEl = makeNodeElement(k, childNode);
    frag.appendChild(nodeEl);
  }

  containerEl.appendChild(frag);
}
function renderTree(container, rootObj) {
  container.innerHTML = "";
  container.classList.add("tree");
  const { root, convoTitleById, convoTypeById } = rootObj;

  // Store the tree structure globally so other parts of the app can use it
  window._treeRoot = root;
  window._convoTitleById = convoTitleById;
  window._convoTypeById = convoTypeById;
  window._treeContainer = container;

  // top-level render: create node elements
  const topKeys = Array.from(root.children.keys()).sort((a, b) => a.toString().localeCompare(b.toString()));
  const topFrag = document.createDocumentFragment();
  for (const k of topKeys) {
    const nodeElem = makeNodeElement(k, root.children.get(k));
    topFrag.appendChild(nodeElem);
  }
  container.appendChild(topFrag);

  return container;
}
function setUpConversationListEvents() {
  async function handleConvoListClick(e) {
    // Handle clicking anywhere in the conversation list, goes for the list item closest to the cursor
    const target = e.target.closest("[data-convo-id]");
    if (target) {
      const convoId = target.dataset.convoId;
      await loadEntriesForConversation(convoId, true);
      return;
    }
    const topLabel = e.target.closest(".label");
    if (topLabel && topLabel.dataset.singleConvo) {
      const convoId = topLabel.dataset.singleConvo;
      await loadEntriesForConversation(convoId, true);
    }
  }
  convoListEl?.addEventListener("click", handleConvoListClick);
  // Handle custom convoLeafClick events from tree builder
  convoListEl?.addEventListener("convoLeafClick", handleNavigateToConvoLeaf);
}
function initializeConversationsForTree() {
  convos = getAllConversations(showHidden());
}
function setupConversationFilter() {
  // Text search filter
  if (convoSearchInput) {
    convoSearchInput.addEventListener("input", filterConversationTree);
  }
  if (convoIdSearchInput) {
    convoIdSearchInput.addEventListener("input", filterConversationTree);
  }

  // Type filter buttons
  convoTypeFilterBtns.forEach((btn) => {
    function handleConvoTypeFilterButtonClick(e) {
      // Update active state
      const btn = e.target;
      convoTypeFilterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Update active filter
      activeTypeFilter = btn.dataset.type;

      // Apply filter
      filterConversationTree();
    }
    btn.addEventListener("click", handleConvoTypeFilterButtonClick);
  });

  // Expand/Collapse all buttons
  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", expandAllTreeNodes);
  }

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener("click", collapseAllTreeNodes);
  }
}
