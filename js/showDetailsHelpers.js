import { entryCache } from "./constants.js";
import { renderConvoDetails, renderEntryDetails } from "./uiHelpers.js";
import {
  getConversationById,
  getActorNameById,
  getEntry,
  getAlternates,
  getChecks,
  getParentsChildren,
} from "./sqlHelpers.js";
import { showHidden } from "./userSettings.js";
import {
  getCurrentAlternateCondition,
  getCurrentAlternateLine,
  getCurrentConvoId,
  getCurrentEntryId,
} from "./navigation.js";
import { entryListEl } from "./constants.js";
import { currentEntryContainerEl, moreDetailsEl } from "./constants.js";
import { $ } from "./uiHelpers.js";

const entryDetailsEl = $("entryDetails");

export async function showConvoDetails(convoId) {
  if (!entryDetailsEl) return;

  const coreRow = getConversationById(convoId, showHidden());

  if (!coreRow) {
    entryDetailsEl.textContent = "(not found)";
  }

  const convoActor = getActorNameById(coreRow.actor);
  const convoConversantActor = getActorNameById(coreRow.conversant);

  let taskDetails = {
    displayConditionMain: coreRow.displayConditionMain,
    doneConditionMain: coreRow.doneConditionMain,
    cancelConditionMain: coreRow.cancelConditionMain,
    taskReward: coreRow.taskReward,
    taskTimed: coreRow.taskTimed,
    totalSubtasks: coreRow.totalSubtasks,
  };

  renderConvoDetails(entryDetailsEl, {
    convoId: coreRow.id,
    conversationTitle: coreRow.title,
    conversationDescription: coreRow.description,
    conversationActorId: coreRow.actor,
    conversationActorName: convoActor.name,
    conversationConversantId: coreRow.conversant,
    conversationConversantName: convoConversantActor.name,
    type: coreRow.type,
    isHidden: coreRow.isHidden,
    totalEntries: coreRow.totalEntries,
    onUse: coreRow.onUse,
    overrideDialogueCondition: coreRow.overrideDialogueCondition,
    alternateOrbText: coreRow.alternateOrbText,
    checkType: coreRow.checkType,
    condition: coreRow.condition,
    instruction: coreRow.instruction,
    placement: coreRow.placement,
    difficulty: coreRow.difficulty,
    totalSubtasks: coreRow.totalSubtasks,
    taskDetails: taskDetails,
  });
}
export async function showEntryDetails(
  convoId,
  entryId,
  selectedAlternateCondition = null,
  selectedAlternateLine = null,
) {
  if (!entryDetailsEl) return;
  // Fetch core row early so it can be referenced by cached fallback values
  const coreRow = getEntry(convoId, entryId);

  // Check cache only if viewing the original (no alternate selected)
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const cached = entryCache.get(`${convoId}:${entryId}`); // Get Cached Entry
    if (cached) {
      renderEntryDetails(entryDetailsEl, {
        ...cached,
        selectedAlternateCondition: null,
        selectedAlternateLine: null,
        originalDialogueText:
          cached.originalDialogueText || coreRow?.dialoguetext,
      });
      return;
    }
  }
  if (!coreRow) {
    entryDetailsEl.textContent = "(not found)";
    return;
  }

  // Fetch alternates, checks, parents/children
  const alternates = coreRow.hasAlts > 0 ? getAlternates(convoId, entryId) : [];
  const checks = coreRow.hasCheck > 0 ? getChecks(convoId, entryId) : [];
  const { parents, children } = getParentsChildren(convoId, entryId);
  // Get conversation data
  const convoRow = getConversationById(convoId) || {};
  // Get actor
  const entryActor = getActorNameById(coreRow.actor);
  const convoActor = getActorNameById(convoRow.actor);
  const convoConversantActor = getActorNameById(convoRow.conversant);
  // Get actor names and colors
  let entryActorName = entryActor?.name;
  let convoActorName = convoActor?.name;
  let convoConversantActorName = convoConversantActor?.name;
  let entryActorColor = entryActor?.color;
  let convoActorColor = convoActor?.color;
  let convoConversantActorColor = convoConversantActor?.color;

  const payload = {
    convoId: convoId,
    entryId: entryId,
    title: coreRow.title,
    actorId: coreRow.actor,
    actorName: entryActorName,
    actorColor: entryActorColor,
    alternates,
    checks,
    parents,
    children,
    conversationTitle: convoRow.title,
    conversationDescription: convoRow.description,
    conversationActorId: convoRow.actor,
    conversationActorName: convoActorName,
    conversationActorColor: convoActorColor,
    conversationConversantId: convoRow.conversant,
    conversationConversantName: convoConversantActorName,
    conversationConversantColor: convoConversantActorColor,
    sequence: coreRow.sequence,
    conditionstring: coreRow.conditionstring,
    userscript: coreRow.userscript,
    difficultypass: coreRow.difficultypass,
    selectedAlternateCondition: selectedAlternateCondition,
    selectedAlternateLine: selectedAlternateLine,
    originalDialogueText: coreRow.dialoguetext,
    isHidden: coreRow.isHidden,
    type: convoRow.type,
    totalEntries: convoRow.totalEntries,
    onUse: convoRow.onUse,
    overrideDialogueCondition: convoRow.overrideDialogueCondition,
    alternateOrbText: convoRow.alternateOrbText,
    checkType: convoRow.checkType,
    condition: convoRow.condition,
    instruction: convoRow.instruction,
    placement: convoRow.placement,
    difficulty: convoRow.difficulty,
    totalSubtasks: convoRow.totalSubtasks,
  };

  // Only cache the base data without alternate-specific info
  // This prevents stale alternate data from being served from cache
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const basePayload = { ...payload };
    delete basePayload.selectedAlternateCondition;
    delete basePayload.selectedAlternateLine;
    entryCache.set(`${convoId}:${entryId}`, basePayload); // Cache Entry
  }

  renderEntryDetails(entryDetailsEl, payload);
}
export function setUpMoreDetails() {
  async function handleMoreDetailsClicked() {
    if (moreDetailsEl.open) {
      if (getCurrentConvoId() && getCurrentEntryId()) {
        await showEntryDetails(
          getCurrentConvoId(),
          getCurrentEntryId(),
          getCurrentAlternateCondition(),
          getCurrentAlternateLine(),
        );
      } else if (getCurrentConvoId()) {
        await showConvoDetails(getCurrentConvoId());
      }
      // Make dialogue options compact when More Details is expanded
      const entryListContainer = entryListEl?.closest(".entry-list");
      if (
        entryListContainer &&
        !entryListContainer.classList.contains("compact")
      ) {
        entryListContainer.setAttribute("data-was-expanded", "true");
        entryListContainer.classList.add("compact");
      }
      if (
        currentEntryContainerEl &&
        !currentEntryContainerEl.classList.contains("expanded")
      ) {
        currentEntryContainerEl.setAttribute("data-was-expanded", "true");
        currentEntryContainerEl.classList.add("expanded");
      }
    } else {
      // Restore original state when More Details is collapsed
      const entryListContainer = entryListEl?.closest(".entry-list");
      if (
        entryListContainer &&
        entryListContainer.dataset.wasExpanded === "true"
      ) {
        entryListContainer.classList.remove("compact");
        delete entryListContainer.dataset.wasExpanded;
      }
      if (
        currentEntryContainerEl &&
        currentEntryContainerEl.dataset.wasExpanded === "true"
      ) {
        currentEntryContainerEl.classList.remove("expanded");
        delete currentEntryContainerEl.dataset.wasExpanded;
      }
    }
  }

  moreDetailsEl?.addEventListener("toggle", handleMoreDetailsClicked);
}
