import { sidebarOverlay } from "./constants.js";
import { toggleElementVisibility, toggleElementVisibilityBySelector } from "./uiHelpers.js";

export function closeAllSidebars() {
  toggleElementVisibilityBySelector(".sidebar", false)
  toggleElementVisibility(sidebarOverlay, false);
}
export function closeAllModals() {
  toggleElementVisibilityBySelector(".modal-overlay", false);
}
