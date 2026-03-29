import { toggleElementVisibility } from "./uiHelpers.js";
import { STORAGE_KEY } from "./constants.js";
import { defaultMobileColumns } from "./constants.js";
import { defaultColumns } from "./constants.js";
import { browserGrid } from "./constants.js";
import { desktopMediaQuery } from "./constants.js";
import { tabletMediaQuery } from "./constants.js";
import { mobileMediaQuery } from "./constants.js";
import { disableColumnResizing } from "./userSettings.js";

// State for column resizing handlers
let currentPointerMoveHandler = null;
let currentStartX = null;
let currentInitialCol1 = null;
let currentInitialCol3 = null;

export function updateResizeHandles() {
  const leftHandle = document.querySelector(".resize-handle-left");
  const rightHandle = document.querySelector(".resize-handle-right");

  if (
    disableColumnResizing() ||
    mobileMediaQuery.matches ||
    tabletMediaQuery.matches
  ) {
    if (leftHandle) leftHandle.classList.add("disabled");
    if (rightHandle) rightHandle.classList.add("disabled");
  } else {
    if (leftHandle) leftHandle.classList.remove("disabled");
    if (rightHandle) rightHandle.classList.remove("disabled");
  }
}
export function updateHandlePositions() {
  const columns = getStartColumns();
  const col1 = columns[0];
  const col3 = columns[2];
  browserGrid.style.setProperty("--handle-left-pos", `calc(${col1} - 4px)`);
  browserGrid.style.setProperty("--handle-right-pos", `calc(${col3} - 4px)`);
}
export function setUpResizableColumns() {
  if (!browserGrid || !desktopMediaQuery.matches) return;

  const convoSection = browserGrid.querySelector(".convo-section");
  const entriesSection = browserGrid.querySelector(".entries-section");
  const historySection = browserGrid.children[2];

  if (!convoSection || !entriesSection || !historySection) return;

  // Store grid column widths in local storage
  const savedColumns = localStorage.getItem(STORAGE_KEY);

  applySavedColumns(savedColumns);

  // Create resize handles
  let leftHandle = document.querySelector(".resize-handle.resize-handle-left");
  if (!leftHandle) {
    leftHandle = document.createElement("div");
    leftHandle.className = "resize-handle resize-handle-left";
    leftHandle.title = "Drag to resize sections";
    browserGrid.appendChild(leftHandle);
  } else {
    toggleElementVisibility(leftHandle, true);
  }
  let rightHandle = document.querySelector(
    ".resize-handle.resize-handle-right",
  );
  if (!rightHandle) {
    rightHandle = document.createElement("div");
    rightHandle.className = "resize-handle resize-handle-right";
    rightHandle.title = "Drag to resize sections";
    browserGrid.appendChild(rightHandle);
  } else {
    toggleElementVisibility(rightHandle, true);
  }

  // Initialize handle positions
  updateHandlePositions();

  // Apply disabled state if column resizing is disabled
  if (disableColumnResizing()) {
    leftHandle.classList.add("disabled");
    rightHandle.classList.add("disabled");
  }

  leftHandle.addEventListener("pointerdown", handleLeftHandlePointerDown);
  rightHandle.addEventListener("pointerdown", handleRightHandlePointerDown);
}

function getStartColumns() {
  return (browserGrid.style.gridTemplateColumns || defaultColumns)
    .split(" ")
    .map((s) => s.trim());
}
function applySavedColumns(savedColumns) {
  if (!desktopMediaQuery.matches) {
    browserGrid.style.gridTemplateColumns = defaultMobileColumns;
  }
  if (savedColumns) {
    try {
      const columns = JSON.parse(savedColumns);
      browserGrid.style.gridTemplateColumns = columns.join(" ");
    } catch (e) {
      console.error("Failed to restore grid columns", e);
      browserGrid.style.gridTemplateColumns = defaultColumns;
    }
  }
}
function handlePointerMoveLeft(moveEvent) {
  const deltaX = moveEvent.clientX - currentStartX;
  const initialCol1 = currentInitialCol1 ?? parseFloat(getStartColumns()[0]);
  const initialCol3 = currentInitialCol3 ?? parseFloat(getStartColumns()[2]);
  const col1 = Math.max(200, Math.min(500, initialCol1 + deltaX));
  const newColumns = `${col1}px 1fr ${initialCol3}px`;
  browserGrid.style.gridTemplateColumns = newColumns;
  updateHandlePositions();
}
function handlePointerMoveRight(moveEvent) {
  const deltaX = moveEvent.clientX - currentStartX;
  const initialCol3 = currentInitialCol3 ?? parseFloat(getStartColumns()[2]);
  const initialCol1 = currentInitialCol1 ?? parseFloat(getStartColumns()[0]);
  const col3 = Math.max(200, Math.min(500, initialCol3 - deltaX));
  const newColumns = `${initialCol1}px 1fr ${col3}px`;
  browserGrid.style.gridTemplateColumns = newColumns;
  updateHandlePositions();
}
function handlePointerUp() {
  if (currentPointerMoveHandler) {
    document.removeEventListener("pointermove", currentPointerMoveHandler);
    currentPointerMoveHandler = null;
  }
  currentStartX = null;
  currentInitialCol1 = null;
  currentInitialCol3 = null;
  const currentColumns = browserGrid.style.gridTemplateColumns;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(currentColumns.split(" ").map((s) => s.trim())),
  );
  document.removeEventListener("pointerup", handlePointerUp);
}
function handleLeftHandlePointerDown(e) {
  if (disableColumnResizing()) return;
  e.preventDefault();
  currentStartX = e.clientX;
  const startCols = getStartColumns();
  currentInitialCol1 = parseFloat(startCols[0]);
  currentInitialCol3 = parseFloat(startCols[2]);
  currentPointerMoveHandler = (ev) => handlePointerMoveLeft(ev);
  document.addEventListener("pointermove", currentPointerMoveHandler);
  document.addEventListener("pointerup", handlePointerUp);
}
function handleRightHandlePointerDown(e) {
  if (disableColumnResizing()) return;
  e.preventDefault();
  currentStartX = e.clientX;
  const startCols = getStartColumns();
  currentInitialCol1 = parseFloat(startCols[0]);
  currentInitialCol3 = parseFloat(startCols[2]);
  currentPointerMoveHandler = (ev) => handlePointerMoveRight(ev);
  document.addEventListener("pointermove", currentPointerMoveHandler);
  document.addEventListener("pointerup", handlePointerUp);
}
