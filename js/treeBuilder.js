// treeBuilder.js (lazy + iterative rendering + simple virtualization)
// Builds a hierarchical tree and renders nodes lazily when expanded. For large child lists,
// it renders in batches with a "Show more" button to avoid DOM bloat.

export function buildTitleTree(rows) {
  const root = { children: new Map(), convoIds: [] };
  const convoTitleById = Object.create(null);
  rows.forEach((r) => {
    const id = r.id;
    const raw = (r.title || `(id ${id})`).trim();
    convoTitleById[id] = raw;
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
  return { root, convoTitleById };
}

// Top-level wrapper that passes correct parent keys
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

// Returns { node, newKey }
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
      currentKey = currentKey + " / " + current.convoIds[0];
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

// Render tree with all data loaded. container must be a block element.
export function renderTree(container, rootObj, opts = {}) {
  container.innerHTML = "";
  container.classList.add("tree");
  const { root, convoTitleById } = rootObj;

  // Store the tree structure globally so other parts of the app can use it
  window._treeRoot = root;
  window._convoTitleById = convoTitleById;
  window._treeContainer = container;

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
    toggle.textContent =
      nodeObj._subtreeSize > 1 && !hasCollapsedLeaf ? "▸" : "";
    label.appendChild(toggle);

    const titleSpan = document.createElement("span");
    titleSpan.textContent = name;
    label.appendChild(titleSpan);

    wrapper.appendChild(label);

    const childrenContainer = document.createElement("div");
    childrenContainer.className = "children";
    wrapper.appendChild(childrenContainer);

    // store a reference
    wrapper._nodeObj = nodeObj;
    wrapper._childrenRendered = false;

    // Render children immediately but keep collapsed
    renderChildrenInto(nodeObj, childrenContainer, convoTitleById);
    wrapper._childrenRendered = true;

    // click handler: navigate if leaf, or toggle expand
    label.addEventListener("click", (ev) => {
      ev.stopPropagation();

      // if this is a collapsed leaf (has single convoId, no children)
      if (hasCollapsedLeaf) {
        label.dispatchEvent(
          new CustomEvent("convoLeafClick", {
            detail: { convoId: nodeObj.convoIds[0] },
            bubbles: true,
          })
        );
        return;
      }

      // if this node's subtree is a single conversation, dispatch event
      const total = nodeObj._subtreeSize || 0;
      if (total === 1 && nodeObj.convoIds.length === 1) {
        label.dispatchEvent(
          new CustomEvent("convoLeafClick", {
            detail: { convoId: nodeObj.convoIds[0] },
            bubbles: true,
          })
        );
        return;
      }

      // For non-leaf nodes, toggle expand/collapse
      const isExpanded = wrapper.classList.toggle("expanded");
      toggle.textContent = isExpanded ? "▾" : "▸";
    });

    return wrapper;
  }

  // Helper to extract final segment from full title path
  function getLastSegment(fullTitle) {
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
        leafLabel.textContent = finalSegment;
        leaf.appendChild(leafLabel);
        frag.appendChild(leaf);
      }
    }

    // Render all child nodes
    const keys = Array.from(nodeObj.children.keys()).sort((a, b) =>
      a.localeCompare(b)
    );
    for (const k of keys) {
      const childNode = nodeObj.children.get(k);
      const nodeEl = makeNodeElement(k, childNode);
      frag.appendChild(nodeEl);
    }

    containerEl.appendChild(frag);
  }

  // top-level render: create node elements
  const topKeys = Array.from(root.children.keys()).sort((a, b) =>
    a.localeCompare(b)
  );
  const topFrag = document.createDocumentFragment();
  for (const k of topKeys) {
    const nodeElem = makeNodeElement(k, root.children.get(k));
    topFrag.appendChild(nodeElem);
  }
  container.appendChild(topFrag);

  return container;
}
