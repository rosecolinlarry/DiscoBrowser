import { injectTemplate } from "./uiHelpers.js";
import { $ } from "./uiHelpers.js";

export async function injectIconTemplates() {
  // Create a container element and add templates to it
  const iconTemplateContainerId = "icon-template-container";
  const iconTemplateFileName = "icon-templates.html";
  let container = $(iconTemplateContainerId);
  if (!container) {
    container = document.createElement("div");
    container.id = iconTemplateContainerId;
    document.body.insertBefore(container, document.body.firstChild);
    // document.body.appendChild(container);
  }
  await injectTemplate(iconTemplateFileName, iconTemplateContainerId);
  initializeIcons();
}
export function setToggleIcon(toggleEl, expanded) {
  if (!toggleEl) return;

  // Only update toggles that are meant to expand/collapse
  if (toggleEl.dataset && toggleEl.dataset.canToggle === "false") return;

  const templateId = "icon-chevron-right-template";
  const template = $(templateId);

  const clone = template.content.cloneNode(true);
  const svg = clone.querySelector("svg");
  if (svg) {
    svg.setAttribute("width", "18px");
    svg.setAttribute("height", "18px");
  }

  toggleEl.innerHTML = "";
  toggleEl.appendChild(clone);

  // Update rotation class for animation
  toggleEl.classList.toggle("toggle-expanded", expanded);
}

function initializeIcons() {
  // Helper function to clone and size an icon template
  function getIcon(templateId, width = "30px", height = "30px") {
    const template = $(templateId);
    const clone = template.content.cloneNode(true);
    const svg = clone.querySelector("svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    return clone;
  }

  // Apply icons for any placeholder with data-icon-template
  const dataPlaceholders = document.querySelectorAll(
    ".icon-placeholder[data-icon-template]"
  );

  dataPlaceholders.forEach((placeholder) => {
    const templateId = placeholder.dataset.iconTemplate;
    if (!templateId) return;
    const iconWidth = placeholder.dataset.iconWidth || placeholder.dataset.iconSize || "30px";
    const iconHeight = placeholder.dataset.iconHeight ||
      placeholder.dataset.iconSize ||
      iconWidth;
    const iconClone = getIcon(templateId, iconWidth, iconHeight);
    placeholder.replaceWith(...iconClone.childNodes);
  });
}