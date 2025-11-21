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
    const parts = raw.split("/").map(p => p.trim()).filter(Boolean);
    if (!parts.length) parts.push(raw);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part)) node.children.set(part, { children: new Map(), convoIds: [] });
      node = node.children.get(part);
      if (i === parts.length - 1) node.convoIds.push(id);
    }
  });
  // compute sizes iteratively using a stack
  computeSizesIterative(root);
  return { root, convoTitleById };
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

  // Batch size for virtualization of long lists
  const BATCH = opts.batchSize || 150;

  function makeNodeElement(name, nodeObj) {
    const wrapper = document.createElement("div");
    wrapper.className = "node";

    const label = document.createElement("div");
    label.className = "label";

    const toggle = document.createElement("span");
    toggle.className = "toggle";
    toggle.textContent = nodeObj._subtreeSize > 1 ? "▸" : "";
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

    // click handler: expand/collapse or treat single-convo as shortcut
    label.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // if this node's subtree is a single conversation, mark dataset and let main handle opening
      const total = nodeObj._subtreeSize || 0;
      if (total === 1 && nodeObj.convoIds.length === 1) {
        // this label should act as a shortcut; set dataset.singleConvo and let caller use it
        label.dataset.singleConvo = nodeObj.convoIds[0];
        return;
      }

      const isExpanded = wrapper.classList.toggle("expanded");
      toggle.textContent = isExpanded ? "▾" : "▸";

      if (isExpanded) {
        // populate children lazily
        if (!wrapper._childrenRendered) {
          renderChildrenInto(nodeObj, childrenContainer, convoTitleById, BATCH);
          wrapper._childrenRendered = true;
        }
      }
    });

    return wrapper;
  }

  function renderChildrenInto(nodeObj, containerEl, titleMap, batchSize) {
    containerEl.innerHTML = "";
    const frag = document.createDocumentFragment();

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
        leafLabel.dataset.convoId = cid;
        leafLabel.style.cursor = "pointer";
        leafLabel.textContent = `${titleMap[cid] || ('(id '+cid+')')} — #${cid}`;
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
            leafLabel.textContent = `${titleMap[cid] || ('(id '+cid+')')} — #${cid}`;
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
    const keys = Array.from(nodeObj.children.keys()).sort((a,b)=>a.localeCompare(b));
    for (const k of keys) {
      const childNode = nodeObj.children.get(k);
      const nodeEl = makeNodeElement(k, childNode);
      frag.appendChild(nodeEl);
    }

    containerEl.appendChild(frag);
  }

  // top-level render: create node elements (do not populate children)
  const topKeys = Array.from(root.children.keys()).sort((a,b)=>a.localeCompare(b));
  const topFrag = document.createDocumentFragment();
  for (const k of topKeys) {
    const nodeElem = makeNodeElement(k, root.children.get(k));
    topFrag.appendChild(nodeElem);
  }
  container.appendChild(topFrag);

  return container;
}
