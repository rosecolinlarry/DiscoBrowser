import { $, toggleElementVisibility } from "./uiHelpers.js";
import { closeAllSidebars, closeAllModals } from "./closeElementsHelpers.js";
import {
  convoSidebar,
  convoSidebarToggle,
  historySidebar,
  historySidebarToggle,
  sidebarOverlay,
} from "./constants.js";

const mobileNavBtn = $("mobileNavBtn");
const mobileNavSidebarClose = $("navSidebarClose");
const historySidebarClose = $("historySidebarClose");
const convoSidebarClose = $("convoSidebarClose");

export function setUpSidebarToggles() {
  convoSidebarToggle?.addEventListener("click", openConversationSidebar);
  historySidebarToggle?.addEventListener("click", openHistorySidebar);
  mobileNavBtn.addEventListener("click", openMobileNavSidebar);
  sidebarOverlay.addEventListener("click", closeAllSidebars);
  sidebarOverlay.addEventListener("click", closeAllModals);
  mobileNavSidebarClose?.addEventListener("click", closeMobileNavSidebar);
  historySidebarClose?.addEventListener("click", closeHistorySidebar);
  convoSidebarClose?.addEventListener("click", closeConversationSection);
}

const mobileNavPanel = $("mobileNavPanel");

export function openConversationSidebar() {
  closeAllSidebars();
  toggleElementVisibility(convoSidebar, true);
  toggleElementVisibility(sidebarOverlay, true);
}
function openHistorySidebar() {
  closeAllSidebars();
  toggleElementVisibility(historySidebar, true);
  toggleElementVisibility(sidebarOverlay, true);
}
function closeHistorySidebar() {
  toggleElementVisibility(historySidebar, false);
  toggleElementVisibility(sidebarOverlay, false);
}
function openMobileNavSidebar() {
  closeAllSidebars();
  toggleElementVisibility(mobileNavPanel, true);
  toggleElementVisibility(sidebarOverlay, true);
}
function closeMobileNavSidebar() {
  toggleElementVisibility(mobileNavPanel, false);
  toggleElementVisibility(sidebarOverlay, false);
}
function closeConversationSection() {
  toggleElementVisibility(convoSidebar, false);
  toggleElementVisibility(sidebarOverlay, false);
}
