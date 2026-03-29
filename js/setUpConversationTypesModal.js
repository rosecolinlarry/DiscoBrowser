import { $, injectTemplate, toggleElementVisibility } from "./uiHelpers.js";

const modalId = "conversationTypesModalOverlay";
const conversationTypesModalOverlay = $(modalId);

export async function setupConversationTypesModal() {
  await injectTemplate(
    "conversation-types-modal.html",
    "conversationTypesModalOverlay",
  );
  const helpIcon = $("helpIcon");
  const closeBtn = conversationTypesModalOverlay.querySelector(".modal-close");

  helpIcon.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  conversationTypesModalOverlay.addEventListener(
    "click",
    handleConvoTypeModalOverlayClick,
  );

  document.addEventListener("keydown", handleEscPressed);
}

function openModal() {
  toggleElementVisibility(conversationTypesModalOverlay, true);
}
function closeModal() {
  conversationTypesModalOverlay.classList.remove("open");
  toggleElementVisibility(conversationTypesModalOverlay, false);
}
function handleEscPressed(e) {
  if (
    e.key === "Escape" &&
    conversationTypesModalOverlay.style.display !== "none"
  ) {
    closeModal();
  }
}
function handleConvoTypeModalOverlayClick(e) {
  if (e.target == conversationTypesModalOverlay) {
    closeModal();
  }
}