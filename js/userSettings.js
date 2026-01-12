import { $, toggleElementVisibility } from "./ui.js";
import {
  defaultColumns,
  STORAGE_KEY,
  updateHandlePositions,
  updateResizeHandles,
  rebuildConversationTree
} from "./main.js";
// Settings state
const SETTINGS_STORAGE_KEY = "discobrowser_settings";

const resetDesktopLayoutCheckboxId = "resetDesktopLayoutCheckbox";
const disableColumnResizingCheckboxId = "disableColumnResizingCheckbox";
const alwaysShowMoreDetailsCheckboxId = "alwaysShowMoreDetailsCheckbox";
const showHiddenCheckboxId = "showHiddenCheckbox";
const turnOffAnimationsCheckboxId = "turnOffAnimationsCheckbox";

const settingsModalOverlayId = "settingsModalOverlay";
const settingsModalCloseId = "settingsModalClose";
const restoreDefaultSettingsBtnId = "restoreDefaultSettingsBtn";
const saveSettingsBtnId = "saveSettingsBtn";
const settingsBtnId = "settingsBtn";

// Default app settings
let appSettings = {
  resetDesktopLayout: false,
  disableColumnResizing: false,
  showHidden: false,
  turnOffAnimations: false,
  alwaysShowMoreDetails: false,
};

const DEFAULT_APP_SETTINGS = {
  resetDesktopLayout: false,
  disableColumnResizing: false,
  showHidden: false,
  turnOffAnimations: false,
  alwaysShowMoreDetails: false,
};

const template = `
      <div
        class="modal settings-modal"
        role="dialog"
        aria-labelledby="settingsModalTitle"
        aria-modal="true"
      >
        <div class="modal-header">
          <h3 id="settingsModalTitle">Settings</h3>
          <button
            id="settingsModalClose"
            class="modal-close button-icon"
            aria-label="Close"
          >
            <div
              class="icon-placeholder"
              data-icon-template="icon-close-template"
              data-icon-size="24px"
            ></div>
          </button>
        </div>
        <div class="modal-body settings-body">
          <div class="settings-section">
            <label class="settings-checkbox checkbox-label">
              <input type="checkbox" id="resetDesktopLayoutCheckbox" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Reset desktop layout</span>
            </label>
            <p class="settings-description">
              Resets the layout to the default column sizes and positions.
              (Desktop Only)
            </p>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox checkbox-label">
              <input type="checkbox" id="disableColumnResizingCheckbox" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Disable column resizing</span>
            </label>
            <p class="settings-description">
              Hides and disables the ability to resize columns. (Desktop Only)
            </p>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox checkbox-label">
              <input type="checkbox" id="alwaysShowMoreDetailsCheckbox" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Always show more details</span>
            </label>
            <p class="settings-description">
              Automatically expands the More Details section when viewing
              entries.
            </p>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox checkbox-label">
              <input type="checkbox" id="showHiddenCheckbox" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Show hidden</span>
            </label>
            <p class="settings-description">
              Include conversations and entries marked as hidden.
            </p>
          </div>
          <div class="settings-section">
            <label class="settings-checkbox checkbox-label">
              <input type="checkbox" id="turnOffAnimationsCheckbox" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Turn off animations</span>
            </label>
            <p class="settings-description">
              Disables all animations throughout the application.
            </p>
          </div>
          <div class="settings-actions">
            <button id="restoreDefaultSettingsBtn">
              Restore Default Settings
            </button>
            <button id="saveSettingsBtn">Save Settings</button>
          </div>
        </div>
      </div>
  `;

// #region Exported Set Up Helpers
export function injectUserSettingsTemplate() {
  // Create container if it does not exist
  let container = $(settingsModalOverlayId);
  if (!container) {
    container = document.createElement("div");
    container.className = "modal-overlay hidden";
    container.id = settingsModalOverlayId;
    document.body.appendChild(container);
  }
  container.innerHTML = template;
}
export function initializeUserSettings() {
  loadSettingsFromStorage();
  applySettings();
  setUpCheckboxHandlers();
  setupSettingsModal();
  setUpSaveButton();
  setUpRestoreDefaultSettingsButton();
}

export function applySettings() {
  // Apply animations toggle
  updateAnimationsToggle();
  updateHandlePositions();
  updateResizeHandles();
  // Apply column resizing toggle - handled in initializeResizableGrid
  // Apply show hidden toggle - handled when building tree
  // Apply reset desktop layout - this is a one-time action, not persistent
}
function setUpCheckboxHandlers() {
  const resetDesktopLayoutCheckbox = $(resetDesktopLayoutCheckboxId);

  if (resetDesktopLayoutCheckbox) {
    resetDesktopLayoutCheckbox.addEventListener(
      "change",
      handleResetDesktopLayoutChange
    );
  }
  const disableColumnResizingCheckbox = $(disableColumnResizingCheckboxId);

  if (disableColumnResizingCheckbox) {
    disableColumnResizingCheckbox.addEventListener(
      "change",
      handleDisableColumnResizingChange
    );
  }
  const alwaysShowMoreDetailsCheckbox = $(alwaysShowMoreDetailsCheckboxId);

  if (alwaysShowMoreDetailsCheckbox) {
    alwaysShowMoreDetailsCheckbox.addEventListener(
      "change",
      handleAlwaysShowMoreDetailsChange
    );
  }
  const showHiddenCheckbox = $(showHiddenCheckboxId);

  if (showHiddenCheckbox) {
    showHiddenCheckbox.addEventListener("change", handleShowHiddenChange);
  }
  const turnOffAnimationsCheckbox = $(turnOffAnimationsCheckboxId);

  if (turnOffAnimationsCheckbox) {
    turnOffAnimationsCheckbox.addEventListener("change", handleTurnOffAnimationsChange);
  }
}

function setUpSaveButton() {
  // Handle save settings
  const saveSettingsBtn = $(saveSettingsBtnId);
  if(saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', handleSaveSettingsButtonClick)
  }
}

function setupSettingsModal() {
  // Open settings modal
  
  const settingsBtn = $(settingsBtnId)
  const settingsModalClose = $(settingsModalCloseId)
  const settingsModalOverlay = $(settingsModalOverlayId)

  // Open settings modal
  if(settingsBtn) {
    settingsBtn.addEventListener("click", openSettings);
  }
  // Close settings modal
  if (settingsModalClose) {
    settingsModalClose.addEventListener("click", () => {
      toggleElementVisibility(settingsModalOverlay, false);
    });
  }

  // Close modal when clicking overlay
  if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener("click", (e) => {
      if (e.target === settingsModalOverlay) {
        toggleElementVisibility(settingsModalOverlay, false);
      }
    });
  }
}

// #endregion

// #region Exported Getters
export function disableColumnResizing() {
  return appSettings?.disableColumnResizing ?? DEFAULT_APP_SETTINGS.disableColumnResizing;
}

export function alwaysShowMoreDetails() {
  return appSettings?.alwaysShowMoreDetails ?? DEFAULT_APP_SETTINGS.alwaysShowMoreDetails;
}

export function showHidden() {
  return appSettings?.showHidden ?? DEFAULT_APP_SETTINGS.showHidden;
}
// #endregion

// #region Manage App Setting States
function updateCurrentUserSettings() {
  // Update settings from checkbox values
  const currentCheckboxValues = {
    resetDesktopLayout: $(resetDesktopLayoutCheckboxId)?.checked ?? false,
    disableColumnResizing: $(disableColumnResizingCheckboxId)?.checked ?? false,
    alwaysShowMoreDetails: $(alwaysShowMoreDetailsCheckboxId)?.checked ?? false,
    showHidden: $(showHiddenCheckboxId)?.checked ?? false,
    turnOffAnimations: $(turnOffAnimationsCheckboxId)?.checked ?? false,
  };
  appSettings = currentCheckboxValues;
}
function setCurrentUserSettings() {
  // Update checkbox values from settings
  if (!appSettings) {
    // Get app settings from storage
    loadSettingsFromStorage();
  }
  const resetDesktopLayoutCheckbox = $(resetDesktopLayoutCheckboxId);
  if (resetDesktopLayoutCheckbox) {
    resetDesktopLayoutCheckbox.checked = appSettings?.resetDesktopLayout;
  }
  const disableColumnResizingCheckbox = $(disableColumnResizingCheckboxId);
  if (disableColumnResizingCheckbox) {
    disableColumnResizingCheckbox.checked = appSettings?.disableColumnResizing;
  }
  const alwaysShowMoreDetailsCheckbox = $(alwaysShowMoreDetailsCheckboxId);
  if (alwaysShowMoreDetailsCheckbox) {
    alwaysShowMoreDetailsCheckbox.checked = appSettings?.alwaysShowMoreDetails;
  }
  const showHiddenCheckbox = $(showHiddenCheckboxId);
  if (showHiddenCheckbox) {
    showHiddenCheckbox.checked = appSettings?.showHidden;
  }
  const turnOffAnimationsCheckbox = $(turnOffAnimationsCheckboxId);
  if (turnOffAnimationsCheckbox) {
    turnOffAnimationsCheckbox.checked = appSettings?.turnOffAnimations;
  }
}
function resetCurrentUserSettings() {
  // Update app setting values to default settings
  appSettings = DEFAULT_APP_SETTINGS;
  setCurrentUserSettings();
}
function loadSettingsFromStorage() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      appSettings = { ...appSettings, ...parsed };
      return appSettings;
    }
  } catch (e) {
    appSettings = DEFAULT_APP_SETTINGS;
    console.error("Failed to load settings from storage", e);
  }
}
function saveSettingsToStorage() {
  try {
    updateDesktopLayout();

    applySettings();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
  } catch (e) {
    console.error("Failed to save settings to storage", e);
  }
}

// #endregion

// #region Update UI
function updateDesktopLayout() {
  const resetDesktopLayoutCheckbox = $(resetDesktopLayoutCheckboxId);
  // Layout resets on save
  if (resetDesktopLayoutCheckbox) {
    if (appSettings?.resetDesktopLayout) {
      const browserGrid = $("browser");
      browserGrid.style.gridTemplateColumns = defaultColumns;
      localStorage.removeItem(STORAGE_KEY);
    }
    resetDesktopLayoutCheckbox.checked = false;
    appSettings.resetDesktopLayout = false;
  }
}

function updateAnimationsToggle() {
  if (appSettings?.turnOffAnimations) {
    document.body.classList.add("animations-disabled");
  } else {
    document.body.classList.remove("animations-disabled");
  }
}
// #region
// #region Handlers
function handleResetDesktopLayoutChange(e) {
  // Reset desktop layout should be unchecked once the layout is reset (upon save)
  let value = DEFAULT_APP_SETTINGS.resetDesktopLayout;
  if (e) {
    value = e.target?.checked ?? value;
  }
  appSettings.resetDesktopLayout = value;
}
function handleDisableColumnResizingChange(e) {
  let value = DEFAULT_APP_SETTINGS.disableColumnResizing;
  if (e) {
    value = e.target?.checked ?? value;
  }
  appSettings.disableColumnResizing = value;
}
function handleShowHiddenChange(e) {
  let value = DEFAULT_APP_SETTINGS.showHidden;
  if (e) {
    value = e.target?.checked ?? value;
  }
  appSettings.showHidden = value;
}
function handleTurnOffAnimationsChange(e) {
  let value = DEFAULT_APP_SETTINGS.turnOffAnimations;
  if (e) {
    value = e.target?.checked ?? value;
  }
  appSettings.turnOffAnimations = value;
}
function handleAlwaysShowMoreDetailsChange(e) {
  let value = DEFAULT_APP_SETTINGS.alwaysShowMoreDetails;
  if (e) {
    value = e.target?.checked ?? value;
  }
  appSettings.alwaysShowMoreDetails = value;
}
function setUpRestoreDefaultSettingsButton() {
  // Restore default settings and updates checkbox values.
  const restoreDefaultSettingsBtn = $(restoreDefaultSettingsBtnId);
  if(restoreDefaultSettingsBtn) {
    restoreDefaultSettingsBtn.addEventListener("click", resetCurrentUserSettings)
  }
}
function handleSaveSettingsButtonClick() {
  // Apply settings
  updateCurrentUserSettings();
  applySettings();
  saveSettingsToStorage();

  // Rebuild tree to reflect hidden/title settings
  rebuildConversationTree();

  // Save and close modal
  const settingsModalOverlay = $(settingsModalOverlayId);
  if (settingsModalOverlay) {
    toggleElementVisibility(settingsModalOverlay, false);
  }
}

export function openSettings(e) {
  setCurrentUserSettings();
  const settingsModalOverlay = $(settingsModalOverlayId);
  if (settingsModalOverlay) {
    toggleElementVisibility(settingsModalOverlay, true);
  }
}
// #endregion