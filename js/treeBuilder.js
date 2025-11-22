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
    const parts = raw
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
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

// Render tree lazily. container must be a block element. We add 'tree' class to ensure CSS rules apply.
export function renderTree(container, rootObj, opts = {}) {
  container.innerHTML = "";
  container.classList.add("tree");
  const { root, convoTitleById } = rootObj;

  // Store the tree structure globally so other parts of the app can use it
  window._treeRoot = root;
  window._convoTitleById = convoTitleById;
  window._treeContainer = container;

  // Batch size for virtualization of long lists
  const BATCH = opts.batchSize || 150;

  function makeNodeElement(name, nodeObj) {
    const wrapper = document.createElement("div");
    wrapper.className = "node";

    const label = document.createElement("div");
    label.className = "label";

    // Check if this node contains a collapsed conversation leaf
    // (has exactly one convoId appended to the key)
    const hasCollapsedLeaf = nodeObj.children.size === 0 && nodeObj.convoIds.length === 1;
    
    const toggle = document.createElement("span");
    toggle.className = "toggle";
    toggle.textContent = nodeObj._subtreeSize > 1 && !hasCollapsedLeaf ? "▸" : "";
    label.appendChild(toggle);

    const titleSpan = document.createElement("span");
    titleSpan.textContent = name;
    label.appendChild(titleSpan);

    wrapper.appendChild(label);

    const childrenContainer = document.createElement("div");
    childrenContainer.className = "children";
    // keep empty until expanded
    wrapper.appendChild(childrenContainer);

    // store a reference for lazy rendering
    wrapper._nodeObj = nodeObj;

    // click handler: expand/collapse or treat as leaf if it's a collapsed single conversation
    label.addEventListener("click", (ev) => {
      ev.stopPropagation();
      handleLabelClick();
    });

    // Also handle forceExpand event for programmatic expansion
    label.addEventListener("forceExpand", (ev) => {
      ev.stopPropagation();
      handleLabelClick();
    });

    function handleLabelClick() {
      // if this is a collapsed leaf (has single convoId, no children)
      if (hasCollapsedLeaf) {
        // Dispatch custom event so main.js can handle the navigation
        label.dispatchEvent(new CustomEvent('convoLeafClick', {
          detail: { convoId: nodeObj.convoIds[0] },
          bubbles: true
        }));
        return;
      }
      
      // if this node's subtree is a single conversation, dispatch event
      const total = nodeObj._subtreeSize || 0;
      if (total === 1 && nodeObj.convoIds.length === 1) {
        // Dispatch custom event for navigation
        label.dispatchEvent(new CustomEvent('convoLeafClick', {
          detail: { convoId: nodeObj.convoIds[0] },
          bubbles: true
        }));
        return;
      }

      // For non-leaf nodes, toggle expand/collapse
      const isExpanded = wrapper.classList.toggle("expanded");
      toggle.textContent = isExpanded ? "▾" : "▸";

      if (isExpanded) {
        // populate children lazily
        if (!wrapper._childrenRendered) {
          renderChildrenInto(nodeObj, childrenContainer, convoTitleById, BATCH);
          wrapper._childrenRendered = true;
        }
      }
    }

    return wrapper;
  }

  function renderChildrenInto(nodeObj, containerEl, titleMap, batchSize) {
    containerEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    // Helper to extract final segment from full title path
    function getLastSegment(fullTitle) {
      const parts = fullTitle.split("/").map(p => p.trim()).filter(Boolean);
      return parts[parts.length - 1] || fullTitle;
    }

    // local convo leaves first
    if (nodeObj.convoIds && nodeObj.convoIds.length) {
      const convos = nodeObj.convoIds;
      // virtualization: render first batchSize items, add a "show more" loader if needed
      const total = convos.length;
      const toRender = Math.min(batchSize, total);
      for (let i = 0; i < toRender; i++) {
        const cid = convos[i];
        const leaf = document.createElement("div");
        leaf.className = "leaf";
        const leafLabel = document.createElement("div");
        leafLabel.className = "label";
        leafLabel.dataset.singleConvo = cid;
        leafLabel.dataset.convoId = cid;
        leafLabel.style.cursor = "pointer";
        // show only final segment of the rolled-up key
        const fullTitle = titleMap[cid] || `(id ${cid})`;
        const finalSegment = getLastSegment(fullTitle);
        leafLabel.textContent = finalSegment;
        leaf.appendChild(leafLabel);
        frag.appendChild(leaf);
      }
      if (total > toRender) {
        const more = document.createElement("div");
        more.className = "leaf more-link";
        more.style.cursor = "pointer";
        more.textContent = `Show ${total - toRender} more...`;
        let rendered = toRender;
        more.addEventListener("click", () => {
          // render next batch
          const next = Math.min(batchSize, total - rendered);
          for (let j = 0; j < next; j++) {
            const cid = convos[rendered + j];
            const leaf = document.createElement("div");
            leaf.className = "leaf";
            const leafLabel = document.createElement("div");
            leafLabel.className = "label";
            leafLabel.dataset.convoId = cid;
            leafLabel.style.cursor = "pointer";
            const fullTitle = titleMap[cid] || `(id ${cid})`;
            const finalSegment = getLastSegment(fullTitle);
            leafLabel.textContent = finalSegment;
            leafLabel.dataset.singleConvo = cid;
            leafLabel.dataset.convoId = cid;
            leaf.appendChild(leafLabel);
            frag.appendChild(leaf);
          }
          rendered += next;
          if (rendered >= total) {
            more.remove();
          } else {
            more.textContent = `Show ${total - rendered} more...`;
          }
          containerEl.appendChild(frag);
        });
        frag.appendChild(more);
      }
    }

    // then child nodes
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

  // top-level render: create node elements (do not populate children)
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

/* Global helper to find and expand a conversation in the tree */
export function findAndExpandConversation(convoID) {
  console.log(`[TREE] findAndExpandConversation called for ${convoID}`);
  
  if (!window._treeRoot || !window._treeContainer) {
    console.warn("[TREE] Tree not initialized");
    return null;
  }

  // Step 1: Find which node in the tree structure contains this convoID
  function findConvoInNode(node, path = []) {
    if (node.convoIds && node.convoIds.includes(convoID)) {
      console.log(`[TREE] Found convoID ${convoID} in node structure at path:`, path);
      return { found: true, node, path };
    }

    if (node.children && node.children.size > 0) {
      for (const [key, childNode] of node.children.entries()) {
        const result = findConvoInNode(childNode, [...path, key]);
        if (result.found) return result;
      }
    }

    return { found: false, node: null, path: [] };
  }

  const structureResult = findConvoInNode(window._treeRoot);
  if (!structureResult.found) {
    console.warn(`[TREE] ConvoID ${convoID} not found in tree structure at all`);
    return null;
  }

  console.log(`[TREE] ConvoID found in structure, path:`, structureResult.path);

  // Step 2: Now we need to expand the tree from root down the path to make the label appear
  // First, expand all top-level nodes to see if ours is there
  const topNodes = window._treeContainer.querySelectorAll(":scope > .node");
  console.log(`[TREE] Found ${topNodes.length} top-level nodes in DOM`);

  // Expand each top-level node to see if we can find our conversation
  for (const topNode of topNodes) {
    const topLabel = topNode.querySelector(":scope > .label");
    if (!topLabel) continue;

    console.log(`[TREE] Checking top node with text: "${topLabel.textContent}"`);
    
    // Expand this node if it's not already
    if (!topNode.classList.contains("expanded")) {
      console.log(`[TREE] Expanding top node: "${topLabel.textContent}"`);
      topNode.classList.add("expanded");
      
      // Trigger rendering of children
      const childrenContainer = topNode.querySelector(":scope > .children");
      if (childrenContainer && childrenContainer.children.length === 0 && !topNode._childrenRendered) {
        console.log(`[TREE] Children not rendered yet, triggering click`);
        topLabel.click();
      }
    }
  }

  // Step 3: Search DOM again after expansion
  setTimeout(() => {
    console.log(`[TREE] Searching DOM again after expansion`);
    const allLabels = window._treeContainer.querySelectorAll(".label");
    console.log(`[TREE] Found ${allLabels.length} total labels in DOM`);
    
    for (const lbl of allLabels) {
      const convoId = parseInt(lbl.dataset.convoId, 10);
      const singleConvo = parseInt(lbl.dataset.singleConvo, 10);
      
      if (convoId === convoID || singleConvo === convoID) {
        console.log(`[TREE] FOUND label in DOM for ${convoID}:`, lbl);
        
        // Expand all ancestors
        let current = lbl;
        while (current) {
          const ancestorNode = current.closest(".node");
          if (!ancestorNode) break;

          ancestorNode.classList.add("expanded");
          const toggle = ancestorNode.querySelector(":scope > .label > .toggle");
          if (toggle) toggle.textContent = "▾";

          current = ancestorNode;
        }
        
        // Call the highlight callback with the label
        if (typeof window._onConvoFound === 'function') {
          window._onConvoFound(lbl, convoID);
        }
        return;
      }
    }
    
    console.warn(`[TREE] Still not found in DOM after expansion for ${convoID}`);
  }, 100);

  return null;
}
