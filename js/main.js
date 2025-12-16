// main.js - entry point (use <script type="module"> in index.html)
import { loadSqlJs } from './sqlLoader.js'
import * as DB from './db.js'
import { buildTitleTree, renderTree } from './treeBuilder.js'
import { $ } from './ui.js'
import * as UI from './ui.js'
import { injectIconTemplates } from './icons.js'

// Inject icon templates as soon as the module loads
injectIconTemplates()

const searchInput = $('search')
const searchBtn = $('searchBtn')
const actorFilterBtn = $('actorFilterBtn')
const actorFilterLabel = $('actorFilterLabel')
const actorFilterDropdown = $('actorFilterDropdown')
const actorSearchInput = $('actorSearch')
const actorCheckboxList = $('actorCheckboxList')
const selectAllActors = $('selectAllActors')
const addToSelectionBtn = $('addToSelection')
const typeFilterBtn = $('typeFilterBtn')
const typeFilterLabel = $('typeFilterLabel')
const typeFilterDropdown = $('typeFilterDropdown')
const typeCheckboxList = $('typeCheckboxList')
const variableSearchCheckboxList = $('variableSearchCheckboxList')
const selectAllTypes = $('selectAllTypes')
const searchLoader = $('searchLoader')
const convoListEl = $('convoList')
const convoSearchInput = $('convoSearchInput')
const convoTypeFilterBtns = document.querySelectorAll(
  '.radio-button-group .radio-button'
)
const entryListEl = $('entryList')
const entryListHeaderEl = $('entryListHeader')
const entryDetailsEl = $('entryDetails')
const entryOverviewEl = $('entryOverview')
const currentEntryContainerEl = $('currentEntryContainer')
const moreDetailsEl = $('moreDetails')

// History navigation
const chatLogEl = $('chatLog')
const backBtn = $('backBtn')
const backStatus = $('backStatus')
const convoRootBtn = $('convoRootBtn')

// Sidebar elements
const sidebarOverlay = $('sidebarOverlay')

const convoSection = $('convoSection')
const historySection = $('historySection')

const browserEl = $('browser')

const historySidebarToggle = $('historySidebarToggle')
const historySidebar = $('historySidebar')
const historySidebarClose = $('historySidebarClose')

const convoSidebarToggle = $('convoSidebarToggle')
const convoSidebar = $('convoSidebar')
const convoSidebarClose = $('convoSidebarClose')

// Search option elements
const wholeWordsCheckbox = $('wholeWordsCheckbox')

// Mobile elements
const mobileSearchTrigger = $('mobileSearchTrigger')
const mobileSearchScreen = $('mobileSearchScreen')
const mobileSearchInput = $('mobileSearchInput')
const mobileSearchIconBtn = $('mobileSearchIconBtn')
const mobileSearchBack = $('mobileSearchBack')
const mobileSearchResults = $('mobileSearchResults')
const mobileSearchLoader = $('mobileSearchLoader')
const mobileSearchCount = $('mobileSearchCount')
const mobileClearFilters = $('mobileClearFilters')
const mobileConvoFilter = $('mobileConvoFilter')
const mobileTypeFilter = $('mobileTypeFilter')
const mobileActorFilter = $('mobileActorFilter')
const mobileConvoFilterValue = $('mobileConvoFilterValue')
const mobileTypeFilterValue = $('mobileTypeFilterValue')
const mobileActorFilterValue = $('mobileActorFilterValue')
const mobileConvoFilterScreen = $('mobileConvoFilterScreen')
const mobileActorFilterScreen = $('mobileActorFilterScreen')
const mobileTypeFilterSheet = $('mobileTypeFilterSheet')
const mobileWholeWordsCheckbox = $('mobileWholeWordsCheckbox')
const mobileNavBtn = $('mobileNavBtn')
const mobileNavOverlay = $('mobileNavOverlay')
const mobileNavPanel = $('mobileNavPanel')
const mobileNavHome = $('mobileNavHome')
const mobileNavSettings = $('mobileNavSettings')
const mobileNavSearch = $('mobileNavSearch')
const mobileSidebarToggle = $('mobileSidebarToggle')
const mobileClearSearchBtn = $('mobileSearchClearIcon')

// Tree control elements
const expandAllBtn = $('expandAllBtn')
const collapseAllBtn = $('collapseAllBtn')
const resetLayoutBtn = $('resetLayoutBtn')

// Settings elements
const settingsBtn = $('settingsBtn')
const settingsModalOverlay = $('settingsModalOverlay')
const settingsModalClose = $('settingsModalClose')
const resetDesktopLayoutCheckbox = $('resetDesktopLayoutCheckbox')
const disableColumnResizingCheckbox = $('disableColumnResizingCheckbox')
const alwaysShowMoreDetailsCheckbox = $('alwaysShowMoreDetailsCheckbox')
const showHiddenCheckbox = $('showHiddenCheckbox')
const turnOffAnimationsCheckbox = $('turnOffAnimationsCheckbox')
const useOriginalTitlesCheckbox = $('useOriginalTitlesCheckbox')
const enableAdvancedSearchCheckbox = $('enableAdvancedSearchCheckbox')
const saveSettingsBtn = $('saveSettingsBtn')
const restoreDefaultSettingsBtn = $('restoreDefaultSettingsBtn')
// Advanced search UI
const advancedSearchToggle = $('advancedSearchToggle')
const advancedSearchRow = $('advancedSearchRow')
const variableSearchBtn = $('variableSearchBtn')
const variableSearchDropdown = $('variableSearchDropdown')
const variableSearchLabel = $('variableSearchLabel')
const selectAllVariableSearch = $('selectAllVariableSearch')
const includeVariablesCheckbox = $('includeVariablesCheckbox')
const includeDialogueCheckbox = $('includeDialogueCheckbox')

// Clear filters button
const clearFiltersBtn = $('clearFiltersBtn')

const searchResultLimit = 50

let navigationHistory = []
let currentConvoId = null
let currentEntryId = null
let currentAlternateCondition = null
let currentAlternateLine = null
let conversationTree = null
let activeTypeFilter = 'all'
let allActors = []
let selectedActorIds = new Set()
let selectedTypeIds = new Set(['flow', 'orb', 'task']) // All types selected by default
let filteredActors = []

// Search pagination state
let currentSearchQuery = ''
let currentSearchActorIds = null
let currentSearchOffset = 0
let currentSearchTotal = 0
let currentSearchFilteredCount = 0 // Count after type filtering
let isLoadingMore = false

// Mobile search state
let mobileSelectedConvoIds = new Set()
let mobileSelectedTypes = new Set(['all'])
let mobileSelectedActorIds = new Set()

// Mobile actor filter state
let tempSelectedActorIds = new Set()
let filteredActorsForMobile = []

// Mobile search pagination state
let mobileSearchQuery = ''
let mobileSearchActorIds = null
let mobileSearchOffset = 0
let mobileSearchTotal = 0
let mobileSearchFilteredCount = 0
let isMobileLoadingMore = false

// Browser history state tracking
let currentAppState = 'home' // 'home', 'conversation', 'search'
let isHandlingPopState = false

// Settings state
const SETTINGS_STORAGE_KEY = 'discobrowser_settings'
let appSettings = {
  resetDesktopLayout: false,
  disableColumnResizing: false,
  showHidden: false,
  turnOffAnimations: false,
  alwaysShowMoreDetails: false,
  useOriginalTitles: false,
  enableAdvancedSearch: true,
  includeVariables: true,
  includeDialogue: true
}

// Settings management functions
function loadSettingsFromStorage() {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      appSettings = { ...appSettings, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load settings from storage', e)
  }
}

function getConversationsForTree() {
  const allConvos = DB.getAllConversations()
  if (appSettings.showHidden) {
    // Also include hidden conversations
    const hiddenConvos = DB.execRows(
      `SELECT id, displayTitle, type FROM conversations WHERE isHidden == 1 ORDER BY displayTitle;`
    )
    const merged = [...allConvos, ...hiddenConvos]
    return merged.map(c => ({
      ...c,
      displayTitle: appSettings.useOriginalTitles ? (c.title || c.displayTitle) : c.displayTitle
    }))
  }
  return allConvos.map(c => ({
    ...c,
    displayTitle: appSettings.useOriginalTitles ? (c.title || c.displayTitle) : c.displayTitle
  }))
}

function saveSettingsToStorage() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings))
  } catch (e) {
    console.error('Failed to save settings to storage', e)
  }
}

function applySettings() {
  // Apply animations toggle
  if (appSettings.turnOffAnimations) {
    document.body.classList.add('animations-disabled')
  } else {
    document.body.classList.remove('animations-disabled')
  }

  // Advanced search UI visibility
  if (advancedSearchRow) {
    advancedSearchRow.style.display = appSettings.enableAdvancedSearch ? '' : 'none'
  }
  if (advancedSearchToggle) {
    advancedSearchToggle.checked = appSettings.enableAdvancedSearch
  }
  if (enableAdvancedSearchCheckbox) {
    enableAdvancedSearchCheckbox.checked = appSettings.enableAdvancedSearch
  }

  // Apply column resizing toggle - handled in initializeResizableGrid
  // Apply show hidden toggle - handled when building tree
  // Apply reset desktop layout - this is a one-time action, not persistent
}

function updateSettingsUI() {
  if (resetDesktopLayoutCheckbox) resetDesktopLayoutCheckbox.checked = appSettings.resetDesktopLayout
  if (disableColumnResizingCheckbox) disableColumnResizingCheckbox.checked = appSettings.disableColumnResizing
  if (alwaysShowMoreDetailsCheckbox) alwaysShowMoreDetailsCheckbox.checked = appSettings.alwaysShowMoreDetails
  if (showHiddenCheckbox) showHiddenCheckbox.checked = appSettings.showHidden
  if (turnOffAnimationsCheckbox) turnOffAnimationsCheckbox.checked = appSettings.turnOffAnimations
  if (useOriginalTitlesCheckbox) useOriginalTitlesCheckbox.checked = appSettings.useOriginalTitles
  if (enableAdvancedSearchCheckbox) enableAdvancedSearchCheckbox.checked = appSettings.enableAdvancedSearch
  if (advancedSearchToggle) advancedSearchToggle.checked = appSettings.enableAdvancedSearch
  if (advancedSearchRow) advancedSearchRow.style.display = appSettings.enableAdvancedSearch ? '' : 'none'
  if (includeVariablesCheckbox) includeVariablesCheckbox.checked = appSettings.includeVariables
  if (includeDialogueCheckbox) includeDialogueCheckbox.checked = appSettings.includeDialogue
  if (selectAllVariableSearch) selectAllVariableSearch.checked = appSettings.includeDialogue && appSettings.includeVariables
  updateVariableSearchLabel()
}

function setupSettingsModal() {
  // Open settings modal
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      updateSettingsUI()
      settingsModalOverlay.style.display = 'flex'
    })
  }

  // Close settings modal
  if (settingsModalClose) {
    settingsModalClose.addEventListener('click', () => {
      settingsModalOverlay.style.display = 'none'
    })
  }

  // Close modal when clicking overlay
  if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener('click', (e) => {
      if (e.target === settingsModalOverlay) {
        settingsModalOverlay.style.display = 'none'
      }
    })
  }

  // Handle save settings
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      // Update settings from checkbox values
      appSettings.resetDesktopLayout = resetDesktopLayoutCheckbox?.checked || false
      appSettings.disableColumnResizing = disableColumnResizingCheckbox?.checked || false
      appSettings.alwaysShowMoreDetails = alwaysShowMoreDetailsCheckbox?.checked || false
      appSettings.showHidden = showHiddenCheckbox?.checked || false
      appSettings.turnOffAnimations = turnOffAnimationsCheckbox?.checked || false
      appSettings.useOriginalTitles = useOriginalTitlesCheckbox?.checked || false
      appSettings.enableAdvancedSearch = enableAdvancedSearchCheckbox?.checked ?? true
      appSettings.includeVariables = includeVariablesCheckbox?.checked ?? true
      appSettings.includeDialogue = includeDialogueCheckbox?.checked ?? true
      appSettings.selectAllVariableSearch = selectAllVariableSearch?.checked || (includeVariablesCheckbox?.checked && includeDialogueCheckbox?.checked)

      // Apply settings
      applySettings()
      saveSettingsToStorage()

      // Handle reset layout if checked
      if (appSettings.resetDesktopLayout) {
        const browserGrid = $('browser')
        const defaultColumns = '280px 1fr 280px'
        browserGrid.style.gridTemplateColumns = defaultColumns
        updateHandlePositions()
        localStorage.removeItem('discobrowser_grid_columns')
        appSettings.resetDesktopLayout = false
        resetDesktopLayoutCheckbox.checked = false
      }

      // Update resize handles visibility/functionality
      updateResizeHandles()

      // Rebuild tree to reflect hidden/title settings
      const convos = getConversationsForTree()
      conversationTree = buildTitleTree(convos)
      renderTree(convoListEl, conversationTree)
      if (currentConvoId !== null) {
        highlightConversationInTree(currentConvoId)
      }

      // Save and close modal
      saveSettingsToStorage()
      settingsModalOverlay.style.display = 'none'
    })
  }

  // Restore default settings
  if (restoreDefaultSettingsBtn) {
    restoreDefaultSettingsBtn.addEventListener('click', () => {
      appSettings = {
        resetDesktopLayout: false,
        disableColumnResizing: false,
        showHidden: false,
        turnOffAnimations: false,
        alwaysShowMoreDetails: false,
        useOriginalTitles: false,
        includeVariables: true,
        includeDialogue: true
      }
      updateSettingsUI()
    })
  }

  // Advanced search toggle show/hide
  if (advancedSearchToggle && advancedSearchRow) {
    advancedSearchToggle.addEventListener('change', () => {
      appSettings.enableAdvancedSearch = !!advancedSearchToggle.checked
      applySettings()
      saveSettingsToStorage()
    })
  }

  // Settings modal Advanced Search toggle sync
  if (enableAdvancedSearchCheckbox) {
    enableAdvancedSearchCheckbox.addEventListener('change', (e) => {
      appSettings.enableAdvancedSearch = !!e.target.checked
      applySettings()
      saveSettingsToStorage()
    })
  }

  // Variable search checkboxes update label and save settings
  if (includeVariablesCheckbox) {
    includeVariablesCheckbox.addEventListener('change', (e) => {
      updateVariableSearchLabel(e)
      saveSettingsToStorage()
    })
  }
  if (includeDialogueCheckbox) {
    includeDialogueCheckbox.addEventListener('change', (e) => {
      updateVariableSearchLabel(e)
      saveSettingsToStorage()
    })
  }
  if (selectAllVariableSearch) {
    selectAllVariableSearch.addEventListener('change', (e) => {
      updateVariableSearchLabel(e)
      saveSettingsToStorage()
    })
  }
}

function selectAllVariableSearchOptions(checked) {
  includeVariablesCheckbox.checked = checked
  includeDialogueCheckbox.checked = checked
  selectAllVariableSearch.checked = checked
  selectAllVariableSearch.indeterminate = false
  selectAllVariableSearch.dispatchEvent(new Event('change'))
}

function updateVariableSearchLabel(e) {
  let text = 'Include Variables'
  let includeVars = includeVariablesCheckbox?.checked ?? appSettings.includeVariables ?? true
  let includeDial = includeDialogueCheckbox?.checked ?? appSettings.includeDialogue ?? true
  let includeAll = selectAllVariableSearch?.checked ?? (appSettings.includeDialogue && appSettings.includeVariables) ?? true

  if (e && e.target === selectAllVariableSearch) {
    includeAll = selectAllVariableSearch.checked
    includeVars = includeAll
    includeDial = includeAll
  }
  else if (e && (e.target === includeVariablesCheckbox)) {
    includeVars = includeVariablesCheckbox?.checked ?? true
    includeAll = includeVars && includeDial
  }
  else if (e && (e.target === includeDialogueCheckbox)) {
    includeDial = includeDialogueCheckbox?.checked ?? true
    includeAll = includeVars && includeDial
  }
  selectAllVariableSearch.checked = includeAll
  selectAllVariableSearch.indeterminate = includeVars !== includeDial
  includeDialogueCheckbox.checked = includeDial
  includeVariablesCheckbox.checked = includeVars

  appSettings.includeVariables = includeVars
  appSettings.includeDialogue = includeDial

  text = includeVars && includeDial ? 'Include Variables' : (includeVars ? 'Variables only' : (includeDial ? 'Dialogue only' : 'None'))
  if (variableSearchLabel) variableSearchLabel.textContent = text
}

function updateResizeHandles() {
  const leftHandle = document.querySelector('.resize-handle-left')
  const rightHandle = document.querySelector('.resize-handle-right')

  if (appSettings.disableColumnResizing) {
    if (leftHandle) leftHandle.classList.add('disabled')
    if (rightHandle) rightHandle.classList.add('disabled')
  } else {
    if (leftHandle) leftHandle.classList.remove('disabled')
    if (rightHandle) rightHandle.classList.remove('disabled')
  }
}

function updateHandlePositions() {
  const browserGrid = $('browser')
  const columns = (browserGrid.style.gridTemplateColumns || '280px 1fr 280px').split(' ').map(s => s.trim())
  const col1 = columns[0]
  const col3 = columns[2]
  browserGrid.style.setProperty('--handle-left-pos', `calc(${col1} - 4px)`)
  browserGrid.style.setProperty('--handle-right-pos', `calc(${col3} - 4px)`)
}

const mobileMediaQuery = window.matchMedia('(max-width: 768px)')
const tabletMediaQuery = window.matchMedia('(min-width: 769px) and (max-width: 1024px)')
const desktopMediaQuery = window.matchMedia('(min-width: 1025px)')

function setUpMediaQueries() {
  desktopMediaQuery.addEventListener('change', handleMediaQueryChange)
  tabletMediaQuery.addEventListener('change', handleMediaQueryChange)
  mobileMediaQuery.addEventListener('change', handleMediaQueryChange)
  handleMediaQueryChange()
}

function setUpConvoListEvents() {
  if (!convoListEl) return;
  // event delegation: clicks in convoList
  convoListEl.addEventListener('click', (e) => {
    const target = e.target.closest('[data-convo-id]')
    if (target) {
      const convoId = UI.getParsedIntOrDefault(target.dataset.convoId)
      loadEntriesForConversation(convoId, true)
      return
    }
    const topLabel = e.target.closest('.label')
    if (topLabel && topLabel.dataset.singleConvo) {
      const convoId = UI.getParsedIntOrDefault(topLabel.dataset.singleConvo)
      loadEntriesForConversation(convoId, true)
    }
  })

  // Handle custom convoLeafClick events from tree builder
  convoListEl.addEventListener('convoLeafClick', (e) => {
    const convoId = e.detail.convoId
    loadEntriesForConversation(convoId, true)
    highlightConversationInTree(convoId)
  })
}

function setUpChatLogEvents() {
  if (!chatLogEl) return;
  chatLogEl.addEventListener('navigateToConversation', (e) => {
    const convoId = e.detail.convoId
    loadEntriesForConversation(convoId, true)
    highlightConversationInTree(convoId)
  })
}

async function boot() {
  // Initialize icons when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeIcons)

  setUpMediaQueries()

  // Load settings from localStorage
  loadSettingsFromStorage()
  applySettings()

  const SQL = await loadSqlJs()
  await DB.initDatabase(SQL, 'db/discobase.sqlite3')

  // load conversations & populate actor dropdown
  const convos = getConversationsForTree()

  // Build tree and render (includes all types: flow, orb, task)
  conversationTree = buildTitleTree(convos)
  renderTree(convoListEl, conversationTree)

  // Set up conversation filter
  setupConversationFilter()
  // Set up conversation list events
  setUpConvoListEvents()

  // Handle navigateToConversation events from history dividers
  setUpChatLogEvents()

  // Set up filter dropdowns to open and close
  setUpFilterDropdowns()

  // actor dropdown
  await populateActorDropdown()

  // type filter dropdown
  setupTypeFilter()

  // clear filters button
  setupClearFiltersButton()

  // Make header clickable to go home
  const headerTitle = document.querySelector('h1')
  if (headerTitle) {
    headerTitle.style.cursor = 'pointer'
    headerTitle.addEventListener('click', goBackHomeWithBrowserHistory)
  }

  // wire search
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () =>
      searchDialogues(searchInput.value)
    )
    searchInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') searchDialogues(searchInput.value)
    })
  }

  // Whole words toggle - trigger search when changed
  if (wholeWordsCheckbox) {
    wholeWordsCheckbox.addEventListener('change', () => {
      triggerSearch()
    })
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Use browser back button instead of manual history management
      window.history.back()
    })
  }

  if (convoRootBtn) {
    convoRootBtn.addEventListener('click', () => {
      if (currentConvoId !== null) {
        jumpToConversationRoot()
      }
    })
  }

  updateBackButtonState()

  if (moreDetailsEl) {
    moreDetailsEl.addEventListener('toggle', handleMoreDetailsClicked)
  }

  // Setup infinite scroll for search
  setupSearchInfiniteScroll()
  setupMobileSearchInfiniteScroll()

  // Setup mobile sidebar
  setupMobileSidebar()
  setUpSidebarToggles()

  // Setup mobile navigation panel
  setupMobileNavigation()

  // Setup mobile search
  setupMobileSearch()
  setupClearSearchInput()

  // Initialize mobile filter labels
  updateMobileConvoFilterLabel()
  updateMobileActorFilterLabel()
  updateMobileTypeFilterLabel()

  // Setup browser history handling
  setupBrowserHistory()

  // Set up conversation type modal
  setupConversationTypesModal()

  // Initialize resizable grid
  initializeResizableGrid()

  // Set up settings modal
  setupSettingsModal()
}

function initializeResizableGrid() {
  const browserGrid = $('browser')
  if (!browserGrid || !desktopMediaQuery.matches) return

  const convoSection = browserGrid.querySelector('.convo-section')
  const entriesSection = browserGrid.querySelector('.entries-section')
  const historySection = browserGrid.children[2]

  if (!convoSection || !entriesSection || !historySection) return

  // Store grid column widths in local storage
  const STORAGE_KEY = 'discobrowser_grid_columns'
  const defaultColumns = '280px 1fr 280px'
  const savedColumns = localStorage.getItem(STORAGE_KEY)

  if (savedColumns) {
    try {
      const columns = JSON.parse(savedColumns)
      browserGrid.style.gridTemplateColumns = columns.join(' ')
    } catch (e) {
      console.error('Failed to restore grid columns', e)
      browserGrid.style.gridTemplateColumns = defaultColumns
    }
  } else {
    // Set default columns on first load / hard refresh
    browserGrid.style.gridTemplateColumns = defaultColumns
  }

  // Create resize handles
  const leftHandle = document.createElement('div')
  leftHandle.className = 'resize-handle resize-handle-left'
  leftHandle.title = 'Drag to resize sections'

  const rightHandle = document.createElement('div')
  rightHandle.className = 'resize-handle resize-handle-right'
  rightHandle.title = 'Drag to resize sections'

  // Append handles to grid
  browserGrid.appendChild(leftHandle)
  browserGrid.appendChild(rightHandle)

  // Helper function to update handle positions
  function updateHandlePositions() {
    const columns = (browserGrid.style.gridTemplateColumns || '280px 1fr 280px').split(' ').map(s => s.trim())
    const col1 = columns[0]
    const col3 = columns[2]
    browserGrid.style.setProperty('--handle-left-pos', `calc(${col1} - 4px)`)
    browserGrid.style.setProperty('--handle-right-pos', `calc(${col3} - 4px)`)
  }

  // Initialize handle positions
  updateHandlePositions()

  // Apply disabled state if column resizing is disabled
  if (appSettings.disableColumnResizing) {
    leftHandle.classList.add('disabled')
    rightHandle.classList.add('disabled')
  }

  // Left handle: resize convo and entries sections
  leftHandle.addEventListener('mousedown', (e) => {
    if (appSettings.disableColumnResizing) return
    e.preventDefault()
    const startX = e.clientX
    const startColumns = (browserGrid.style.gridTemplateColumns || '280px 1fr 280px').split(' ').map(s => s.trim())
    const initialCol1 = parseFloat(startColumns[0])

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX
      const col1 = Math.max(200, Math.min(500, initialCol1 + deltaX))
      const newColumns = `${col1}px 1fr ${startColumns[2]}`
      browserGrid.style.gridTemplateColumns = newColumns
      updateHandlePositions()
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      const currentColumns = browserGrid.style.gridTemplateColumns
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentColumns.split(' ').map(s => s.trim())))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  // Right handle: resize entries and history sections
  rightHandle.addEventListener('mousedown', (e) => {
    if (appSettings.disableColumnResizing) return
    e.preventDefault()
    const startX = e.clientX
    const startColumns = (browserGrid.style.gridTemplateColumns || '280px 1fr 280px').split(' ').map(s => s.trim())
    const initialCol3 = parseFloat(startColumns[2])

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX
      const col3 = Math.max(200, Math.min(500, initialCol3 - deltaX))
      const newColumns = `${startColumns[0]} 1fr ${col3}px`
      browserGrid.style.gridTemplateColumns = newColumns
      updateHandlePositions()
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      const currentColumns = browserGrid.style.gridTemplateColumns
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentColumns.split(' ').map(s => s.trim())))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  })

  // Add reset layout button handler
  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener('click', () => {
      const defaultColumns = '280px 1fr 280px'
      browserGrid.style.gridTemplateColumns = defaultColumns
      updateHandlePositions()
      localStorage.removeItem(STORAGE_KEY)
    })
  }
}

function handleMediaQueryChange() {
  closeAllSidebars()
  closeMobileSearchScreen()
  if (desktopMediaQuery.matches) {
    toggleElementVisibilityById('historySidebarToggle', false)
    toggleElementVisibilityById('convoSidebarToggle', false)
    browserEl?.prepend(convoSection)
    browserEl?.appendChild(historySection)
  } else if (tabletMediaQuery.matches) {
    toggleElementVisibilityById('historySidebarToggle', true)
    toggleElementVisibilityById('convoSidebarToggle', true)
    historySidebar?.appendChild(historySection)
    convoSidebar?.appendChild(convoSection)
  } else if (mobileMediaQuery.matches) {
    toggleElementVisibilityById('historySidebarToggle', true)
    toggleElementVisibilityById('convoSidebarToggle', false)
    historySidebar?.append(historySection)
    convoSidebar?.appendChild(convoSection)
  }
}

function toggleElementVisibilityById(id, showElement) {
  const el = $(id)
  el.style.display = showElement ? '' : 'none'
}

function setUpSidebarToggles() {
  convoSidebarToggle.addEventListener('click', openConversationSection)
  historySidebarToggle.addEventListener('click', openHistorySidebar)
  sidebarOverlay.addEventListener('click', closeAllSidebars)
}

function setupConversationFilter() {
  // Text search filter
  if (convoSearchInput) {
    convoSearchInput.addEventListener('input', () => {
      filterConversationTree()
    })
  }

  // Type filter buttons
  convoTypeFilterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Update active state
      convoTypeFilterBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')

      // Update active filter
      activeTypeFilter = btn.dataset.type

      // Apply filter
      filterConversationTree()
    })
  })

  // Expand/Collapse all buttons
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', () => {
      expandAllTreeNodes()
    })
  }

  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', () => {
      collapseAllTreeNodes()
    })
  }
}

function updateTreeControlButtons(enableButtons) {
  if (expandAllBtn) {
    expandAllBtn.disabled = !enableButtons
  }
  if (collapseAllBtn) {
    collapseAllBtn.disabled = !enableButtons
  }
}

function setToggleIcon(toggleEl, expanded) {
  if (!toggleEl) return

  // Only update toggles that are meant to expand/collapse
  if (toggleEl.dataset && toggleEl.dataset.canToggle === 'false') return

  const templateId = 'icon-chevron-right-template';
  const template = document.getElementById(templateId)

  const clone = template.content.cloneNode(true)
  const svg = clone.querySelector('svg')
  if (svg) {
    svg.setAttribute('width', '18px')
    svg.setAttribute('height', '18px')
  }

  toggleEl.innerHTML = ''
  toggleEl.appendChild(clone)

  // Update rotation class for animation
  toggleEl.classList.toggle('toggle-expanded', expanded)
}

function expandAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll('.node')
  allNodes.forEach((node) => {
    const toggle = node.querySelector('.toggle')
    if (toggle && toggle.dataset.canToggle === 'true' && !node.classList.contains('expanded')) {
      node.classList.add('expanded')
      setToggleIcon(toggle, true)
    }
  })
}

function collapseAllTreeNodes() {
  const allNodes = convoListEl.querySelectorAll('.node')
  allNodes.forEach((node) => {
    if (node.classList.contains('expanded')) {
      const toggle = node.querySelector('.toggle')
      node.classList.remove('expanded')
      if (toggle && toggle.dataset.canToggle === 'true') {
        setToggleIcon(toggle, false)
      }
    }
  })
}

function filterConversationTree() {
  let searchText
  if (!conversationTree) return
  searchText = convoSearchInput?.value?.toLowerCase().trim() ?? ''

  // If no text search is active
  if (!searchText) {
    // Show full tree when all types selected
    if (activeTypeFilter === 'all') {
      renderTree(convoListEl, conversationTree)
      updateTreeControlButtons(true)
      if (currentConvoId !== null) {
        highlightConversationInTree(currentConvoId)
      }
      return
    }

    // Build a filtered tree for the selected type
    const { convoTitleById, convoTypeById } = conversationTree
    const filteredRows = Object.keys(convoTitleById)
      .map((idStr) => {
        const id = Number(idStr)
        return {
          id,
          displayTitle: convoTitleById[id],
          type: convoTypeById[id] || 'flow',
        }
      })
      .filter((row) => row.type === activeTypeFilter)

    if (filteredRows.length === 0) {
      convoListEl.innerHTML = '(no conversations for selected type)'
      updateTreeControlButtons(false)
      return
    }

    const filteredTree = buildTitleTree(filteredRows)
    renderTree(convoListEl, filteredTree)
    updateTreeControlButtons(true)
    if (currentConvoId !== null) {
      highlightConversationInTree(currentConvoId)
    }
    return
  }

  // Get all matching conversation leaves
  const matches = []
  collectMatchingLeaves(
    conversationTree.root,
    searchText,
    activeTypeFilter,
    matches,
    conversationTree
  )

  // Clear and render matching results directly as a flat list
  convoListEl.innerHTML = ''
  updateTreeControlButtons(false)

  if (matches.length === 0) {
    const noResults = document.createElement('div')
    noResults.className = 'hint-text'
    noResults.textContent = 'No matching conversations found.'
    convoListEl.appendChild(noResults)
    return
  }

  // Render each match as a leaf item
  matches.forEach((match) => {
    const item = createFilteredLeafItem(match, searchText, conversationTree)
    convoListEl.appendChild(item)
  })
}

function collectMatchingLeaves(node, searchText, typeFilter, matches, tree) {
  // Check if this node has conversation IDs
  if (node.convoIds && node.convoIds.length > 0) {
    node.convoIds.forEach((cid) => {
      const convo = DB.getConversationById(cid)
      if (!convo) return

      // Type filter
      if (typeFilter !== 'all' && convo.type !== typeFilter) {
        return
      }

      // Text filter
      if (searchText) {
        const titleMatch = convo.displayTitle
          .toLowerCase()
          .includes(searchText)
        const idMatch = cid.toString().includes(searchText)
        if (titleMatch || idMatch) {
          matches.push({
            convoId: cid,
            title: convo.displayTitle,
            type: convo.type || 'flow',
          })
        }
      } else {
        matches.push({
          convoId: cid,
          title: convo.displayTitle,
          type: convo.type || 'flow',
        })
      }
    })
  }

  // Recursively search children
  if (node.children) {
    for (const child of node.children.values()) {
      collectMatchingLeaves(child, searchText, typeFilter, matches, tree)
    }
  }
}

function createFilteredLeafItem(match, searchText, tree) {
  const wrapper = document.createElement('div')
  wrapper.className = 'node leaf-result'

  const label = document.createElement('div')
  label.className = 'label'
  label.dataset.convoId = match?.convoId

  // No toggle for leaf items
  const toggle = document.createElement('span')
  toggle.className = 'toggle'
  label.appendChild(toggle)

  const titleSpan = document.createElement('span')

  // Highlight matching text (supports quoted phrases and multi-word queries)
  if (searchText) {
    const hasQuotedPhrases = /"[^"]+"/g.test(searchText)
    titleSpan.innerHTML = UI.highlightTerms(
      match?.title || '',
      searchText,
      hasQuotedPhrases
    )
  } else {
    titleSpan.textContent = match?.title
  }

  // Append convo ID without overwriting HTML
  const titleText = titleSpan.textContent || match?.title || ''
  if (!titleText.endsWith(` #${label.dataset.convoId}`)) {
    const idNode = document.createTextNode(` #${label.dataset.convoId}`)
    titleSpan.appendChild(idNode)
  }
  label.appendChild(titleSpan)

  // Add type badge
  if (match?.type !== 'flow') {
    const badge = document.createElement('span')
    badge.className = `type-badge type-${match?.type}`
    badge.textContent = match?.type?.toUpperCase()
    label.appendChild(badge)
  }

  // Apply highlight class based on type
  if (match?.type !== 'flow') {
    label.classList.add(`highlight-${match?.type}`)
  }

  wrapper.appendChild(label)

  // Click handler to load conversation
  label.addEventListener('click', (ev) => {
    ev.stopPropagation()
    label.dispatchEvent(
      new CustomEvent('convoLeafClick', {
        detail: { convoId: match?.convoId },
        bubbles: true,
      })
    )
  })

  return wrapper
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

async function handleMoreDetailsClicked() {
  if (moreDetailsEl.open && currentConvoId && currentEntryId) {
    await showEntryDetails(
      currentConvoId,
      currentEntryId,
      currentAlternateCondition,
      currentAlternateLine
    )
    // Make dialogue options compact when More Details is expanded
    const entryListContainer = entryListEl?.closest('.entry-list')
    if (
      entryListContainer &&
      !entryListContainer.classList.contains('compact')
    ) {
      entryListContainer.setAttribute('data-was-expanded', 'true')
      entryListContainer.classList.add('compact')
    }
    if (
      currentEntryContainerEl &&
      !currentEntryContainerEl.classList.contains('expanded')
    ) {
      currentEntryContainerEl.setAttribute('data-was-expanded', 'true')
      currentEntryContainerEl.classList.add('expanded')
    }
  } else {
    // Restore original state when More Details is collapsed
    const entryListContainer = entryListEl?.closest('.entry-list')
    if (
      entryListContainer &&
      entryListContainer.getAttribute('data-was-expanded') === 'true'
    ) {
      entryListContainer.classList.remove('compact')
      entryListContainer.removeAttribute('data-was-expanded')
    }
    if (
      currentEntryContainerEl &&
      currentEntryContainerEl.getAttribute('data-was-expanded') === 'true'
    ) {
      currentEntryContainerEl.classList.remove('expanded')
      currentEntryContainerEl.removeAttribute('data-was-expanded')
    }
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.filter-dropdown.show').forEach((e) => {
    e.classList.remove('show')
  })
}

function setUpFilterDropdowns() {
  const dropdownButtons = document.querySelectorAll(
    '.search-controls .filter-dropdown-button'
  )
  dropdownButtons.forEach((dropdownButton) => {
    dropdownButton.addEventListener('click', (e) => {
      e.stopPropagation()
      const filterDropdown =
        dropdownButton?.parentElement?.getElementsByClassName(
          'filter-dropdown'
        )[0]
      // Set up toggling dropdown open/close
      if (filterDropdown?.classList.contains('show')) {
        filterDropdown?.classList.remove('show')
      } else {
        closeAllDropdowns()
        filterDropdown?.classList.add('show')
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!filterDropdown?.contains(e.target) && e.target !== typeFilterBtn) {
          filterDropdown?.classList.remove('show')
        }
      })

      // Prevent dropdown from closing when clicking inside
      filterDropdown?.addEventListener('click', (e) => {
        e.stopPropagation()
      })
    })
  })
}


async function populateActorDropdown() {
  allActors = DB.getDistinctActors()
  filteredActors = [...allActors]

  // Search filter
  if (actorSearchInput) {
    actorSearchInput.addEventListener('input', () => {
      filterActors()
    })
  }

  // Select All checkbox
  if (selectAllActors) {
    selectAllActors.addEventListener('change', (e) => {
      const isChecked = e.target.checked
      const checkboxes = actorCheckboxList.querySelectorAll(
        'input[type="checkbox"]'
      )

      checkboxes.forEach((cb) => {
        const actorId = parseInt(cb.dataset.actorId)
        cb.checked = isChecked

        if (isChecked) {
          selectedActorIds.add(actorId)
        } else {
          selectedActorIds.delete(actorId)
        }
      })

      updateActorFilterLabel()
      triggerSearch()
    })
  }

  // Add to Selection button
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener('click', () => {
      const checkboxes = actorCheckboxList.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
      checkboxes.forEach((cb) => {
        selectedActorIds.add(parseInt(cb.dataset.actorId))
      })

      // Clear search and show all with current selection
      actorSearchInput.value = ''
      filterActors()
      updateActorFilterLabel()
      triggerSearch()
    })
  }

  renderActorCheckboxes(allActors)
}

function filterActors() {
  const searchText = actorSearchInput
    ? actorSearchInput.value.toLowerCase().trim()
    : ''

  if (!searchText) {
    filteredActors = [...allActors]
  } else {
    filteredActors = allActors.filter((actor) => {
      return (
        actor.name.toLowerCase().includes(searchText) ||
        actor.id.toString().includes(searchText)
      )
    })
  }

  renderActorCheckboxes(filteredActors)
  updateSelectAllState()
}

function renderActorCheckboxes(actors) {
  actorCheckboxList.innerHTML = ''

  actors.forEach((actor) => {
    const label = document.createElement('label')
    label.className = 'checkbox-item'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.dataset.actorId = actor.id
    checkbox.checked = selectedActorIds.has(actor.id)

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedActorIds.add(actor.id)
      } else {
        selectedActorIds.delete(actor.id)
      }
      updateSelectAllState()
      updateActorFilterLabel()
      triggerSearch()
    })

    const span = document.createElement('span')
    span.textContent = actor.name

    label.appendChild(checkbox)
    label.appendChild(span)
    actorCheckboxList.appendChild(label)
  })

  updateSelectAllState()
}

function updateSelectAllState() {
  if (!selectAllActors) return

  const visibleCheckboxes = actorCheckboxList.querySelectorAll(
    'input[type="checkbox"]'
  )
  const visibleActorIds = Array.from(visibleCheckboxes).map((cb) =>
    parseInt(cb.dataset.actorId)
  )

  const allSelected =
    visibleActorIds.length > 0 &&
    visibleActorIds.every((id) => selectedActorIds.has(id))
  const someSelected = visibleActorIds.some((id) => selectedActorIds.has(id))

  selectAllActors.checked = allSelected
  selectAllActors.indeterminate = !allSelected && someSelected
}

function updateActorFilterLabel() {
  if (!actorFilterLabel) return

  if (
    selectedActorIds.size === 0 ||
    selectedActorIds.size === allActors.length
  ) {
    actorFilterLabel.textContent = 'All Actors'
  } else if (selectedActorIds.size === 1) {
    const actorId = Array.from(selectedActorIds)[0]
    const actor = allActors.find((a) => a.id === actorId)
    actorFilterLabel.textContent = actor ? actor.name : '1 Actor'
  } else {
    actorFilterLabel.textContent = `${selectedActorIds.size} Actors`
  }
}

function triggerSearch() {
  if (searchInput.value) {
    // Always reset search when filters change to clear old results
    // But only push history state if not already in search view
    const isAlreadySearching = currentAppState === 'search'
    if (isAlreadySearching) {
      // Already in search view, manually reset and search without pushing history
      currentSearchOffset = 0
      currentSearchFilteredCount = 0
      entryListEl.innerHTML = ''
      searchDialogues(searchInput.value, false)
    } else {
      // First time searching, push history state
      searchDialogues(searchInput.value, true)
    }
  }
}

// Setup type filter
function setupTypeFilter() {
  if (!typeFilterBtn || !typeFilterDropdown) return

  // Select All checkbox
  if (selectAllTypes) {
    selectAllTypes.addEventListener('change', (e) => {
      const isChecked = e.target.checked
      const checkboxes = typeCheckboxList.querySelectorAll(
        'input[type="checkbox"][data-type]'
      )

      checkboxes.forEach((cb) => {
        const type = cb.dataset.type
        cb.checked = isChecked

        if (isChecked) {
          selectedTypeIds.add(type)
        } else {
          selectedTypeIds.delete(type)
        }
      })

      updateTypeFilterLabel()
      triggerSearch()
    })
  }

  // Individual type checkboxes
  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]'
  )
  typeCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const type = cb.dataset.type

      if (cb.checked) {
        selectedTypeIds.add(type)
      } else {
        selectedTypeIds.delete(type)
      }

      updateTypeSelectAllState()
      updateTypeFilterLabel()
      triggerSearch()
    })
  })

  updateTypeFilterLabel()
}

function updateTypeSelectAllState() {
  if (!selectAllTypes) return

  const typeCheckboxes = typeCheckboxList.querySelectorAll(
    'input[type="checkbox"][data-type]'
  )
  const allTypes = Array.from(typeCheckboxes).map((cb) => cb.dataset.type)

  const allSelected =
    allTypes.length > 0 && allTypes.every((type) => selectedTypeIds.has(type))
  const someSelected = allTypes.some((type) => selectedTypeIds.has(type))

  selectAllTypes.checked = allSelected
  selectAllTypes.indeterminate = !allSelected && someSelected
}

function updateTypeFilterLabel() {
  if (!typeFilterLabel) return

  if (selectedTypeIds.size === 0 || selectedTypeIds.size === 3) {
    typeFilterLabel.textContent = 'All Types'
  } else if (selectedTypeIds.size === 1) {
    const type = Array.from(selectedTypeIds)[0]
    typeFilterLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1)
  } else {
    typeFilterLabel.textContent = `${selectedTypeIds.size} Types`
  }
}

function openHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.add('open')
    historySidebar.style.display = ''
    closeConversationSection()
  }
  if (historySidebarClose) {
    historySidebarClose.addEventListener('click', closeHistorySidebar)
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'block'
  }
}

function closeHistorySidebar() {
  if (historySidebar) {
    historySidebar.classList.remove('open')
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'none'
  }
}

function closeConversationSection() {
  if (convoSidebar) {
    convoSidebar.classList.remove('open')
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'none'
  }
}

function openConversationSection() {
  if (convoSidebar) {
    convoSidebar.classList.add('open')
    convoSidebar.style.display = ''
    closeHistorySidebar()
  }
  if (convoSidebarClose) {
    convoSidebarClose.addEventListener('click', closeConversationSection)
  }
  if (sidebarOverlay) {
    sidebarOverlay.style.display = 'block'
  }
}

function closeMobileSearchScreen() {
  if (mobileSearchScreen) {
    mobileSearchScreen.style.display = 'none'
  }
}

// Setup clear filters button
function setupClearFiltersButton() {
  if (!clearFiltersBtn) return

  clearFiltersBtn.addEventListener('click', () => {
    // Reset actor filters
    selectedActorIds.clear()
    const actorCheckboxes = actorCheckboxList?.querySelectorAll(
      'input[type="checkbox"]'
    )
    if (actorCheckboxes) {
      actorCheckboxes.forEach((cb) => {
        cb.checked = false
      })
    }
    if (selectAllActors) {
      selectAllActors.checked = false
    }
    updateActorFilterLabel()

    // Reset type filters - select all
    selectedTypeIds.clear()
    selectedTypeIds.add('flow')
    selectedTypeIds.add('orb')
    selectedTypeIds.add('task')

    const typeCheckboxes = typeCheckboxList?.querySelectorAll(
      'input[type="checkbox"][data-type]'
    )
    if (typeCheckboxes) {
      typeCheckboxes.forEach((cb) => {
        cb.checked = true
      })
    }
    if (selectAllTypes) {
      selectAllTypes.checked = true
      selectAllTypes.indeterminate = false
    }
    updateTypeFilterLabel()

    // Reset whole words checkbox
    if (wholeWordsCheckbox) {
      wholeWordsCheckbox.checked = false
    }

    // Reset include variables filter - select all
    selectAllVariableSearchOptions(true);

    // Trigger search with cleared filters
    triggerSearch()
  })
}

// Expand and highlight conversation in the conversation tree
function highlightConversationInTree(convoId) {
  // Remove highlight from all labels (both leaf and node labels)
  const allLabels = convoListEl.querySelectorAll('.label.selected')
  allLabels.forEach((label) => {
    label.classList.remove('selected')
  })

  // Find the leaf with data-convo-id
  let leafLabel = convoListEl.querySelector(`[data-convo-id="${convoId}"]`)

  if (leafLabel) {
    // Highlight the leaf label itself and walk up the tree and expand all ancestor nodes
    let node = leafLabel.closest('.node').querySelector('.label')
    node.classList.add('selected')
    node.scrollIntoView()

    // Move up one level
    node = node.parentElement.parentElement.closest('.node')
    while (node) {
      node.classList.add('expanded')
      // Update toggle text
      const toggle = node.querySelector(':scope > .label > .toggle')
      if (toggle) {
        setToggleIcon(toggle, true)
      }

      // Move up one level
      node = node.parentElement?.closest('.node')
    }
  }
}

/* Load entries listing for conversation */
function loadEntriesForConversation(convoId, resetHistory = false) {
  convoId = UI.getParsedIntOrDefault(convoId)

  // If we're coming from home (no current conversation), ensure home state exists
  if (!isHandlingPopState && currentConvoId === null) {
    // Replace current state with home before pushing conversation
    window.history.replaceState({ view: 'home' }, '', window.location.pathname)
  }

  // Push browser history state (unless we're handling a popstate event)
  if (!isHandlingPopState) {
    pushHistoryState('conversation', { convoId })
  }

  // Close mobile sidebar when conversation is selected
  closeAllSidebars()

  // If switching conversations or resetting, clear the chat log
  if (resetHistory || (currentConvoId !== null && currentConvoId !== convoId)) {
    navigationHistory = [{ convoId, entryId: null }]
    if (chatLogEl) {
      chatLogEl.innerHTML = ''
    }
  } else if (resetHistory) {
    navigationHistory = [{ convoId, entryId: null }]
  }

  if (currentEntryContainerEl) currentEntryContainerEl.style.display = 'flex'

  // Hide homepage, show dialogue content

  const homePageContainer = document.getElementById('homePageContainer')
  const dialogueContent = document.getElementById('dialogueContent')

  if (homePageContainer) {
    homePageContainer.style.display = 'none'
  }
  if (dialogueContent) {
    dialogueContent.style.display = 'flex'
  }

  // Remove search mode styling
  const entryListContainer = entryListEl?.closest('.entry-list')
  if (entryListContainer) entryListContainer.classList.remove('full-height')

  // Reset search state to prevent infinite scroll from loading more search results
  currentSearchOffset = 0
  currentSearchTotal = 0
  currentSearchFilteredCount = 0

  // Update current state for conversation root
  currentConvoId = convoId
  currentEntryId = null

  // Disable root button at conversation root
  if (convoRootBtn) {
    convoRootBtn.disabled = true
  }

  // Update mobile nav buttons (at root, so hide both)
  updateMobileNavButtons()

  // Show conversation metadata instead of entry details
  const conversation = DB.getConversationById(convoId)
  if (conversation) {
    UI.renderConversationOverview(entryOverviewEl, conversation)
  }

  // Make sure current entry container is visible
  if (currentEntryContainerEl) {
    currentEntryContainerEl.style.visibility = 'visible'
  }

  // Show "(no details)" in More Details section for conversation overview
  if (entryDetailsEl) {
    entryDetailsEl.innerHTML = '<div class=\'hint-text\'>(no details)</div>'
  }

  // Hide More Details for conversation overviews (no dentries)
  if (moreDetailsEl) {
    moreDetailsEl.style.display = 'none'
  }

  // Check conversation type - orbs and tasks often don't have meaningful entries
  const convoType = conversation?.type || 'flow'

  entryListHeaderEl.textContent = 'Next Dialogue Options'
  entryListEl.innerHTML = ''

  if (convoType === 'orb' || convoType === 'task') {
    // Orbs and tasks don't have dialogue options - make the section compact
    entryListEl.classList.add('compact')
    // Expand the current entry container to use more space
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add('expanded')
    }
    const message = document.createElement('div')
    message.className = 'hint-text'
    message.style.fontStyle = 'italic'
    message.style.padding = '12px'
    message.innerHTML = `This is ${convoType === 'orb' ? 'an' : 'a'
      } <strong>${convoType.toUpperCase()}</strong> and does not have dialogue options.`
    entryListEl.appendChild(message)
    return
  }

  // For flows, remove compact class and expanded class
  entryListEl.classList.remove('compact')
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove('expanded')
  }

  const rows = DB.getEntriesForConversation(convoId)
  const filtered = rows.filter(
    (r) => (r.title || '').toLowerCase() !== 'start'
  )
  if (!filtered.length) {
    // No entries - make compact like orbs/tasks
    entryListEl.classList.add('compact')
    const entryList = entryListEl.closest('.entry-list')
    if (entryList) entryList.classList.add('compact')
    if (currentEntryContainerEl) {
      currentEntryContainerEl.classList.add('expanded')
    }
    const message = document.createElement('div')
    message.className = 'hint-text'
    message.style.fontStyle = 'italic'
    message.style.padding = '12px'
    message.textContent = '(no meaningful entries)'
    entryListEl.appendChild(message)
    return
  }

  // Has entries - remove compact classes
  entryListEl.classList.remove('compact')
  const entryList = entryListEl.closest('.entry-list')
  if (entryList) entryList.classList.remove('compact')
  if (currentEntryContainerEl) {
    currentEntryContainerEl.classList.remove('expanded')
  }

  filtered.forEach((r) => {
    const entryId = UI.getParsedIntOrDefault(r.id)
    const title = UI.getStringOrDefault(r.title, '(no title)')

    const text = r.dialoguetext || ''
    const el = UI.createCardItem(title, convoId, entryId, text)
    el.addEventListener('click', () => navigateToEntry(convoId, entryId))
    entryListEl.appendChild(el)
  })
}

function goBackHomeWithBrowserHistory() {
  // Use browser history to go back to home
  if (currentConvoId !== null || currentAppState !== 'home') {
    window.history.pushState({ view: 'home' }, '', window.location.pathname)
    goToHomeView()
  }
}

/* Navigation / history functions */
function updateBackButtonState() {
  if (!backBtn) return
  backBtn.disabled = navigationHistory.length <= 1
  if (backStatus) {
    if (navigationHistory.length > 1) {
      backStatus.textContent = `(${navigationHistory.length - 1} step${navigationHistory.length - 1 !== 1 ? 's' : ''
        })`
    } else {
      backStatus.textContent = '(none)'
    }
  }
}

// Modal: Conversation Types on mobile
function setupConversationTypesModal() {
  const helpIcon = document.querySelector('.help-icon')
  const overlay = document.getElementById('conversationTypesModalOverlay')
  const closeBtn = document.getElementById('conversationTypesModalClose')
  if (!helpIcon || !overlay || !closeBtn) return

  const openModal = () => {
    // Only on mobile or tablet
    if (!mobileMediaQuery.matches && !tabletMediaQuery.matches) return
    overlay.style.display = 'flex'
    helpIcon.classList.add('active')
  }

  const closeModal = () => {
    overlay.style.display = 'none'
    helpIcon.classList.remove('active')
  }

  helpIcon.addEventListener('click', (e) => {
    // On mobile or tablet, show modal instead of relying on title tooltip
    if (mobileMediaQuery.matches || tabletMediaQuery.matches) {
      e.preventDefault()
      e.stopPropagation()
      openModal()
    }
  })

  // Backdrop click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal()
    }
  })

  // Close button
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    closeModal()
  })

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') {
      closeModal()
    }
  })
}

// Browser History Management
function setupBrowserHistory() {
  // Set initial state
  window.history.replaceState({ view: 'home' }, '', window.location.pathname)
  currentAppState = 'home'

  // Handle browser back/forward buttons
  window.addEventListener('popstate', async (event) => {
    if (isHandlingPopState) return
    isHandlingPopState = true

    const state = event.state

    // Always close mobile search screen if it's open (when navigating via back button)
    closeMobileSearchScreen()

    if (!state || state.view === 'home') {
      // Go back to home view
      goToHomeView()
    } else if (state.view === 'conversation') {
      if (state.convoId && state.entryId) {
        // Going to a specific entry
        // Determine if we're going backwards or forwards
        const isGoingBack =
          navigationHistory.length > 0 &&
          navigationHistory[navigationHistory.length - 1] &&
          (navigationHistory[navigationHistory.length - 1].convoId !==
            state.convoId ||
            navigationHistory[navigationHistory.length - 1].entryId !==
            state.entryId)

        if (isGoingBack) {
          // Going backwards - remove current entry (non-clickable) and the last clickable entry
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild) // Remove current
          }
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild) // Remove last clickable
          }
          navigationHistory.pop()
        }

        // Navigate to the entry
        await navigateToEntry(state.convoId, state.entryId, !isGoingBack)
      } else if (state.convoId) {
        // Going to conversation root
        const isGoingBack = navigationHistory.length > 1

        if (isGoingBack) {
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild) // Remove current
          }
          if (chatLogEl && chatLogEl.lastElementChild) {
            chatLogEl.removeChild(chatLogEl.lastElementChild) // Remove last clickable
          }
          navigationHistory.pop()
        }

        loadEntriesForConversation(state.convoId, false)
      }
    } else if (state.view === 'search') {
      // Going back to search should actually go to home since search is a "forward" action
      goToHomeView()
    }

    currentAppState = state?.view || 'home'

    // Update UI state
    updateBackButtonState()
    if (typeof updateMobileNavButtons === 'function') {
      updateMobileNavButtons()
    }

    setTimeout(() => {
      isHandlingPopState = false
    }, 100)
  })
}

function pushHistoryState(view, data = {}) {
  if (isHandlingPopState) return

  const state = { view, ...data }
  currentAppState = view
  window.history.pushState(state, '', window.location.pathname)
}

function goToHomeView() {
  // Clear current conversation
  currentConvoId = null
  currentEntryId = null
  navigationHistory = []

  // Clear chat log
  if (chatLogEl) {
    chatLogEl.innerHTML = ''
  }
  if (chatLog) {
    chatLog.innerHTML = ''
  }

  // Show homepage, hide dialogue content
  const homePageContainer = document.getElementById('homePageContainer')
  const dialogueContent = document.getElementById('dialogueContent')

  if (homePageContainer) {
    homePageContainer.style.display = 'block'
  }
  if (dialogueContent) {
    dialogueContent.style.display = 'none'
  }

  // Reset entry list header
  if (entryListHeaderEl) {
    entryListHeaderEl.textContent = 'Next Dialogue Options'
  }

  // Clear tree selection
  document.querySelectorAll('.tree-item.selected').forEach((item) => {
    item.classList.remove('selected')
  })

  // Disable mobile back button if visible
  if (backBtn) {
    backBtn.disabled = true
  }

  // Close mobile search if open
  closeMobileSearchScreen()

  updateBackButtonState()
}

/* Jump back to a specific point in history by removing all entries after it */
async function jumpToHistoryPoint(targetIndex) {
  if (targetIndex < 0 || targetIndex >= navigationHistory.length) return

  // If clicking on the last item, do nothing (it's the current entry)
  if (targetIndex === navigationHistory.length - 1) return

  // Remove all chat log items after the target (including current entry display)
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll('.card-item')
    const itemsToRemove = historyItems.length - targetIndex - 1
    for (let i = 0; i < itemsToRemove; i++) {
      if (historyItems[historyItems.length - 1 - i]) {
        historyItems[historyItems.length - 1 - i].remove()
      }
    }
  }

  // Remove entries from navigation history after the target
  navigationHistory.splice(targetIndex + 1)

  // Get the target entry
  const target = navigationHistory[targetIndex]
  if (target) {
    const cid = UI.getParsedIntOrDefault(target.convoId)
    const eid = UI.getParsedIntOrDefault(target.entryId)

    // Update current state
    currentConvoId = cid
    currentEntryId = eid

    // Update the UI
    const coreRow = DB.getEntry(currentConvoId, currentEntryId)
    const title = coreRow
      ? coreRow.title
      : `(line ${currentConvoId}:${currentEntryId})`
    const dialoguetext = coreRow ? coreRow.dialoguetext : ''

    // Get conversation type
    const conversation = DB.getConversationById(currentConvoId)
    const convoType = conversation?.type || 'flow'

    UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType)

    // Add current entry to history log (non-clickable)
    if (chatLogEl) {
      const currentTitle = UI.parseSpeakerFromTitle(title) || '(no title)'
      UI.appendHistoryItem(
        chatLogEl,
        `${currentTitle} — #${eid}`,
        dialoguetext,
        targetIndex,
        null, // null means non-clickable
        chatLog
      )
    }

    // Load child options
    loadChildOptions(currentConvoId, currentEntryId)

    // Show details if expanded
    if (moreDetailsEl && moreDetailsEl.open) {
      await showEntryDetails(currentConvoId, currentEntryId)
    }
  }

  updateBackButtonState()
}

/* Jump to conversation root */
function jumpToConversationRoot() {
  if (currentConvoId === null) return

  // Clear all entries except the first one (conversation root)
  if (chatLogEl) {
    const historyItems = chatLogEl.querySelectorAll('.card-item')
    historyItems.forEach((item) => item.remove())
  }

  // Reset to just the conversation root
  navigationHistory = [{ convoId: currentConvoId, entryId: null }]

  // Load the conversation root
  loadEntriesForConversation(currentConvoId, false)
  highlightConversationInTree(currentConvoId)
  updateBackButtonState()
}

/* navigateToEntry simplified */
async function navigateToEntry(
  convoId,
  entryId,
  addToHistory = true,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  // Ensure numeric Ids
  convoId = UI.getParsedIntOrDefault(convoId)
  entryId = UI.getParsedIntOrDefault(entryId)

  // Push browser history state (unless we're handling a popstate event)
  if (!isHandlingPopState && addToHistory) {
    pushHistoryState('conversation', { convoId, entryId })
  }

  // Check if we're at the same entry AND same alternate view
  const sameEntry = currentConvoId === convoId && currentEntryId === entryId
  const sameAlternate =
    currentAlternateCondition === selectedAlternateCondition &&
    currentAlternateLine === selectedAlternateLine

  // If at same entry AND same alternate, only block if trying to add to history
  // This prevents duplicate history entries when clicking the same thing twice
  if (sameEntry && sameAlternate && addToHistory) {
    return
  }

  // If we're at the same entry (regardless of alternate), don't add to history
  // This allows switching between alternates without cluttering history
  if (sameEntry) {
    addToHistory = false
  }

  // Hide homepage, show dialogue content (important for mobile when coming from search)
  const homePageContainer = document.getElementById('homePageContainer')
  const dialogueContent = document.getElementById('dialogueContent')

  if (homePageContainer) {
    homePageContainer.style.display = 'none'
  }
  if (dialogueContent) {
    dialogueContent.style.display = 'flex'
  }

  // Make visible
  if (currentEntryContainerEl) {
    currentEntryContainerEl.style.overflowY = 'auto'
    currentEntryContainerEl.style.display = 'flex'
    currentEntryContainerEl.style.visibility = 'visible'
  }

  // Auto-open More Details if setting enabled
  if (moreDetailsEl && appSettings.alwaysShowMoreDetails) {
    moreDetailsEl.open = true
    moreDetailsEl.style.display = 'block'
  }

  // Also restore entry list layout when navigating from search
  const entryListContainer = entryListEl?.closest('.entry-list')
  if (entryListContainer) {
    entryListContainer.classList.remove('full-height')
  }

  // Reset search state to prevent infinite scroll from loading more search results
  currentSearchOffset = 0
  currentSearchTotal = 0
  currentSearchFilteredCount = 0

  // Clear the hint text if present
  if (chatLogEl) {
    if (
      chatLogEl.children.length === 1 &&
      chatLogEl.children[0].textContent &&
      chatLogEl.children[0].textContent.includes('(navigation log')
    )
      chatLogEl.innerHTML = ''
  }

  if (chatLog) {
    if (
      chatLog.children.length === 1 &&
      chatLog.children[0].textContent &&
      chatLog.children[0].textContent.includes('(navigation log')
    )
      chatLog.innerHTML = ''
  }

  // Remove the previous "current entry" display if it exists (it will become clickable)
  if (addToHistory && chatLogEl && chatLogEl.lastElementChild) {
    const lastItem = chatLogEl.lastElementChild
    if (lastItem.classList.contains('current-entry')) {
      // Make it clickable before adding new current entry
      lastItem.classList.remove('current-entry')
      lastItem.style.cursor = 'pointer'
      const historyIndex = parseInt(lastItem.dataset.historyIndex)
      lastItem.addEventListener('click', () => {
        jumpToHistoryPoint(historyIndex)
      })
    }
  }

  if (addToHistory) navigationHistory.push({ convoId, entryId })
  updateBackButtonState()

  // Render current entry in the overview section
  const coreRow = DB.getEntry(convoId, entryId)
  const title = coreRow ? coreRow.title : `(line ${convoId}:${entryId})`
  // Use alternate line if provided, otherwise use the original dialogue text
  const dialoguetext =
    selectedAlternateLine || (coreRow ? coreRow.dialoguetext : '')

  // Get conversation type
  const conversation = DB.getConversationById(convoId)
  const convoType = conversation?.type || 'flow'

  UI.renderCurrentEntry(entryOverviewEl, title, dialoguetext, convoType)

  currentConvoId = convoId
  currentEntryId = entryId
  currentAlternateCondition = selectedAlternateCondition
  currentAlternateLine = selectedAlternateLine

  // Add current entry to history log (non-clickable)
  if (addToHistory && chatLogEl) {
    const currentTitle = UI.parseSpeakerFromTitle(title) || '(no title)'
    UI.appendHistoryItem(
      chatLogEl,
      `${currentTitle} — #${entryId}`,
      dialoguetext,
      navigationHistory.length - 1,
      null, // null means non-clickable
      chatLog
    )
  }

  // Show More Details for actual entries (they have dentries)
  if (moreDetailsEl) {
    moreDetailsEl.style.display = 'block'
  }

  // Disable/enable root button
  if (convoRootBtn) {
    convoRootBtn.disabled = currentEntryId === null
  }

  // Update mobile nav buttons
  updateMobileNavButtons()

  // Load child options
  loadChildOptions(convoId, entryId)

  // Show details lazily only when expanded
  if (moreDetailsEl && moreDetailsEl.open) {
    // Clear cache to force reload when switching between alternate views
    if (sameEntry) {
      DB.clearCacheForEntry(convoId, entryId)
    }
    await showEntryDetails(
      convoId,
      entryId,
      selectedAlternateCondition,
      selectedAlternateLine
    )
  }
}

/* Show entry details (optimized) */
async function showEntryDetails(
  convoId,
  entryId,
  selectedAlternateCondition = null,
  selectedAlternateLine = null
) {
  if (!DB || !entryDetailsEl) return

  // Fetch core row early so it can be referenced by cached fallback values
  const entry = DB.getEntry(convoId, entryId)

  // Check cache only if viewing the original (no alternate selected)
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const cached = DB.getCachedEntry(convoId, entryId)
    if (cached) {
      UI.renderEntryDetails(entryDetailsEl, {
        ...cached,
        selectedAlternateCondition: null,
        selectedAlternateLine: null,
        originalDialogueText:
          cached.originalDialogueText || entry?.dialoguetext,
        onNavigate: navigateToEntry,
      })
      return
    }
  }
  if (!entry) {
    entryDetailsEl.textContent = '(not found)'
    return
  }

  // Fetch alternates, checks, parents/children
  const alternates =
    entry.hasalts > 0 ? DB.getAlternates(convoId, entryId) : []
  const checks = entry.hascheck > 0 ? DB.getChecks(convoId, entryId) : []
  const { parents, children } = DB.getParentsChildren(convoId, entryId)
  // Get conversation data
  const convoRow = DB.getConversationById(convoId) || {}
  // Get actor names
  let entryActorName = DB.getActorNameById(entry.actor)
  let convoActorName = DB.getActorNameById(convoRow.actor)
  let convoConversantActorName = DB.getActorNameById(convoRow.conversant)

  const payload = {
    convoId: convoId,
    entryId: entryId,
    title: entry.title,
    actorId: entry.actor,
    actorName: entryActorName,
    alternates,
    checks,
    parents,
    children,
    conversationTitle: convoRow.displayTitle,
    conversationDescription: convoRow.description,
    conversationActorId: convoRow.actor,
    conversationActorName: convoActorName,
    conversationConversantId: convoRow.conversant,
    conversationConversantName: convoConversantActorName,
    sequence: entry.sequence,
    conditionstring: entry.conditionstring,
    userscript: entry.userscript,
    difficultypass: entry.difficultypass,
    selectedAlternateCondition: selectedAlternateCondition,
    selectedAlternateLine: selectedAlternateLine,
    originalDialogueText: entry.dialoguetext,
    onNavigate: navigateToEntry,
  }

  // Only cache the base data without alternate-specific info
  // This prevents stale alternate data from being served from cache
  if (!selectedAlternateCondition && !selectedAlternateLine) {
    const basePayload = { ...payload }
    delete basePayload.selectedAlternateCondition
    delete basePayload.selectedAlternateLine
    DB.cacheEntry(convoId, entryId, basePayload)
  }

  UI.renderEntryDetails(entryDetailsEl, payload)
}

/* Search */
function searchDialogues(q, resetSearch = true) {
  const trimmedQ = q.trim()

  if (resetSearch) {
    // Push browser history state for search view
    if (!isHandlingPopState) {
      pushHistoryState('search', { query: trimmedQ })
    }

    // Starting a new search
    currentSearchQuery = trimmedQ
    currentSearchOffset = 0
  }

  // Always update actor IDs from current filter selection (even when re-filtering)
  currentSearchActorIds =
    selectedActorIds.size === 0 || selectedActorIds.size === allActors.length
      ? null
      : Array.from(selectedActorIds)

  if (resetSearch) {
    searchLoader?.classList.remove('hidden')

    // Hide homepage, show dialogue content for search
    const homePageContainer = document.getElementById('homePageContainer')
    const dialogueContent = document.getElementById('dialogueContent')

    if (homePageContainer) {
      homePageContainer.style.display = 'none'
    }
    if (dialogueContent) {
      dialogueContent.style.display = 'flex'
    }

    // Hide current entry and make search take full space
    if (currentEntryContainerEl) currentEntryContainerEl.style.display = 'none'
    const entryListContainer = entryListEl?.closest('.entry-list')
    if (entryListContainer) {
      entryListContainer.classList.add('full-height')
      entryListContainer.classList.remove('compact')
    }
    if (entryListEl) {
      entryListEl.classList.remove('compact')
    }

    entryListEl.innerHTML = '' // This clears both innerHTML and textContent
  }

  if (isLoadingMore) return
  isLoadingMore = true

  try {
    const response = DB.searchDialogues(
      currentSearchQuery,
      searchResultLimit,
      currentSearchActorIds,
      true, // filterStartInput
      currentSearchOffset,
      undefined, // conversationIds
      wholeWordsCheckbox?.checked || false // wholeWords
    )

    const { results: res, total } = response
    currentSearchTotal = total

    // Advanced search: include/only variables via dropdown selection
    let variableResults = []
    if (appSettings.includeVariables) {
      const varResp = DB.searchVariables(currentSearchQuery, searchResultLimit, currentSearchOffset, wholeWordsCheckbox?.checked || false)
      variableResults = varResp.results
      if (!appSettings.includeDialogue) {
        // Render variables only
        entryListHeaderEl.textContent = 'Search Results (Variables)'
        entryListEl.innerHTML = ''
        variableResults.forEach(v => {
          const div = document.createElement('div')
          div.className = 'card-item result-item'
          const title = document.createElement('div')
          title.className = 'card-title'
          title.textContent = v.name || `(variable #${v.id})`
          const body = document.createElement('div')
          body.className = 'card-body'
          body.textContent = v.description || '(no description)'
          div.appendChild(title)
          div.appendChild(body)
          entryListEl.appendChild(div)
        })
        isLoadingMore = false
        searchLoader?.classList.add('hidden')
        return
      }
    }

    // Filter by conversation type if not all types selected
    let filteredResults = res
    if (selectedTypeIds.size > 0 && selectedTypeIds.size < 3) {
      filteredResults = res.filter((r) => {
        const convo = DB.getConversationById(r.conversationid)
        const type = convo ? convo.type || 'flow' : 'flow'
        return selectedTypeIds.has(type)
      })
    }

    if (resetSearch) {
      entryListHeaderEl.textContent = 'Search Results'
      entryListEl.innerHTML = ''
      currentSearchFilteredCount = 0

      if (!filteredResults.length) {
        entryListEl.innerHTML = '<div>(no matches)</div>'
        entryListHeaderEl.textContent += ` (0)`
        return
      }
    }

    // Update filtered count
    currentSearchFilteredCount += filteredResults.length

    // Update header with current count
    if (selectedTypeIds.size > 0 && selectedTypeIds.size < 3) {
      // Show filtered count when type filter is active
      entryListHeaderEl.textContent = `Search Results (${currentSearchFilteredCount} filtered)`
    } else {
      // Show total count when all types selected
      entryListHeaderEl.textContent = `Search Results (${currentSearchFilteredCount} of ${total})`
    }

    // Add results to list
    filteredResults.forEach((r) => {
      // Check if query contains any quoted phrases
      const hasQuotedPhrases = /"[^"]+"/g.test(currentSearchQuery)

      // For highlighting, if there are quoted phrases, we need special handling
      // Otherwise use the normal query
      const highlightedTitle = UI.highlightTerms(
        r.title || '',
        currentSearchQuery,
        hasQuotedPhrases
      )
      const highlightedText = UI.highlightTerms(
        r.dialoguetext || '',
        currentSearchQuery,
        hasQuotedPhrases
      )

      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid)
      const convoType = convo ? convo.type || 'flow' : 'flow'

      const div = UI.createCardItem(
        highlightedTitle,
        UI.getParsedIntOrDefault(r.conversationid),
        r.id,
        highlightedText,
        true,
        convoType
      )

      div.addEventListener('click', () => {
        const cid = UI.getParsedIntOrDefault(r.conversationid)
        const eid = UI.getParsedIntOrDefault(r.id)

        // Check if this is an orb or task (conversationid === id means it's from dialogues table)
        if (cid === eid) {
          // This is an orb or task, just load the conversation root
          loadEntriesForConversation(cid, true)
          highlightConversationInTree(cid)
        } else {
          // This is a regular flow entry or alternate
          navigationHistory = [{ convoId: cid, entryId: null }]
          // If this is an alternate, pass the condition and alternate line
          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null
          const alternateLine = r.isAlternate ? r.dialoguetext : null
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine)
          highlightConversationInTree(cid)
        }

        document.querySelector('.selected')?.scrollIntoView(true)
      })
      entryListEl.appendChild(div)
    })

    // Include variables appended (when include mode)
    if (appSettings.includeVariables && appSettings.includeDialogue && variableResults.length) {
      variableResults.forEach(v => {
        const div = document.createElement('div')
        div.className = 'card-item result-item'
        const title = document.createElement('div')
        title.className = 'card-title'
        title.textContent = v.name || `(variable #${v.id})`
        const body = document.createElement('div')
        body.className = 'card-body'
        body.textContent = v.description || '(no description)'
        div.appendChild(title)
        div.appendChild(body)
        entryListEl.appendChild(div)
      })
    }

    // Update offset for next load (based on database results, not filtered)
    currentSearchOffset += res.length

    // Remove any existing loading indicator
    searchLoader?.classList.add('hidden')

    // Add loading indicator if there are more results in the database and we got results this time
    if (res.length > 0 && currentSearchOffset < currentSearchTotal) {
      searchLoader?.classList.remove('hidden')
    }
  } catch (e) {
    console.error('Search error', e)
    if (resetSearch) {
      entryListEl.textContent = 'Search error'
    }
  } finally {
    isLoadingMore = false
    searchLoader?.classList.add('hidden')
  }
}

// Setup infinite scroll for search results
function setupSearchInfiniteScroll() {
  if (!entryListEl) return

  entryListEl.addEventListener('scroll', () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = entryListEl.scrollTop
    const scrollHeight = entryListEl.scrollHeight
    const clientHeight = entryListEl.clientHeight

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100

    if (
      scrolledToBottom &&
      !isLoadingMore &&
      currentSearchOffset < currentSearchTotal
    ) {
      // Hide search indicator
      searchLoader?.classList.add('hidden')
      // Load more results
      searchDialogues(currentSearchQuery, false)
    }
  })
}

// Setup infinite scroll for mobile search results
function setupMobileSearchInfiniteScroll() {
  if (!mobileSearchResults) return

  mobileSearchResults.addEventListener('scroll', () => {
    // Check if we're near the bottom and have more results to load
    const scrollTop = mobileSearchResults.scrollTop
    const scrollHeight = mobileSearchResults.scrollHeight
    const clientHeight = mobileSearchResults.clientHeight

    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 100

    if (
      scrolledToBottom &&
      !isMobileLoadingMore &&
      mobileSearchOffset < mobileSearchTotal
    ) {
      // Remove loading indicator
      mobileSearchLoader?.classList.add('hidden')
      // Load more results
      performMobileSearch(false)
    }
  })
}

function loadChildOptions(convoId, entryId) {
  try {
    entryListHeaderEl.textContent = 'Next Dialogue Options'
    entryListEl.innerHTML = ''

    const { children } = DB.getParentsChildren(convoId, entryId)

    const pairs = []
    for (const c of children)
      pairs.push({ convoId: c.d_convo, entryId: c.d_id })

    const destRows = DB.getEntriesBulk(pairs)
    const destMap = new Map(destRows.map((r) => [`${r.convo}:${r.id}`, r]))

    for (const c of children) {
      const dest = destMap.get(`${c.d_convo}:${c.d_id}`)
      if (!dest) continue
      if ((dest.title || '').toLowerCase() === 'start') continue

      const el = UI.createCardItem(
        dest.title,
        c.d_convo,
        c.d_id,
        dest.dialoguetext
      )
      el.addEventListener('click', () => navigateToEntry(c.d_convo, c.d_id))
      entryListEl.appendChild(el)
    }

    if (entryListEl.children.length === 0) {
      // No further options - make compact like orbs/tasks
      entryListEl.classList.add('compact')
      const entryList = entryListEl.closest('.entry-list')
      if (entryList) entryList.classList.add('compact')
      if (currentEntryContainerEl) {
        currentEntryContainerEl.classList.add('expanded')
      }
      const message = document.createElement('div')
      message.className = 'hint-text'
      message.style.fontStyle = 'italic'
      message.style.padding = '12px'
      message.textContent = '(no further options)'
      entryListEl.appendChild(message)
    }
  } catch (e) {
    console.error('Error loading child links', e)
    entryListEl.textContent = '(error loading next options)'
  }
}

/* Mobile Search Functions */
function setupClearSearchInput() {
  if (!mobileSearchInput || !mobileClearSearchBtn) return

  mobileClearSearchBtn.addEventListener('click', () => {
    mobileSearchInput.value = ''
    mobileSearchTrigger.value = ''
    mobileSearchInput.focus()
  })
}

function setupMobileSearch() {
  // Open mobile search screen
  mobileSearchInput.addEventListener('input', () => {
    if (mobileSearchInput.value.trim().length > 0) {
      mobileSearchTrigger.value = mobileSearchInput.value
    }
  })

  if (mobileSearchTrigger) {
    mobileSearchTrigger.addEventListener('click', () => {
      // Push browser history state for mobile search
      if (!isHandlingPopState) {
        pushHistoryState('search')
      }
      mobileSearchScreen.style.display = 'flex'
      mobileSearchInput.focus()
    })
  }

  // Close mobile search screen
  if (mobileSearchBack) {
    mobileSearchBack.addEventListener('click', () => {
      // Use browser back to return to previous state
      window.history.back()
    })
  }

  // Mobile search - Enter key triggers search
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') performMobileSearch()
    })
  }

  // Mobile search icon button
  if (mobileSearchIconBtn) {
    mobileSearchIconBtn.addEventListener('click', () => {
      performMobileSearch()
    })
  }

  // Whole words toggle - trigger search when changed
  if (mobileWholeWordsCheckbox) {
    mobileWholeWordsCheckbox.addEventListener('change', () => {
      // Only trigger search if there's an active query
      if (mobileSearchQuery) {
        performMobileSearch()
      }
    })
  }

  // Clear filters button
  if (mobileClearFilters) {
    mobileClearFilters.addEventListener('click', () => {
      // Clear conversation filter
      mobileSelectedConvoIds.clear()
      if (mobileConvoFilterValue) mobileConvoFilterValue.textContent = 'All'

      // Clear type filter
      mobileSelectedTypes.clear()
      mobileSelectedTypes.add('all')
      if (mobileTypeFilterValue) mobileTypeFilterValue.textContent = 'All'

      // Clear actor filter
      mobileSearchActorIds = null
      if (mobileActorFilterValue) mobileActorFilterValue.textContent = 'All'

      // Clear whole words
      if (mobileWholeWordsCheckbox) {
        mobileWholeWordsCheckbox.checked = false
      }

      // Re-run search if there's an active query
      if (mobileSearchQuery) {
        performMobileSearch()
      }
    })
  }

  // Conversation filter
  if (mobileConvoFilter) {
    mobileConvoFilter.addEventListener('click', () => {
      showMobileConvoFilter()
    })
  }

  // Type filter
  if (mobileTypeFilter) {
    mobileTypeFilter.addEventListener('click', showMobileTypeFilter)
  }

  // Actor filter
  if (mobileActorFilter) {
    mobileActorFilter.addEventListener('click', showMobileActorFilter)
  }

  // Setup conversation filter screen
  setupMobileConvoFilter()

  // Setup actor filter screen
  setupMobileActorFilter()

  // Setup type filter sheet
  setupMobileTypeFilter()
}

function setupMobileSidebar() {
  // Open sidebar
  if (mobileSidebarToggle) {
    mobileSidebarToggle.addEventListener('click', openConversationSection)
  }
  if (convoSidebarToggle) {
    convoSidebarToggle.addEventListener('click', openConversationSection)
  }

  // Mobile back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Use browser back button instead of manual history management
      window.history.back()
    })
  }

  // Mobile root button
  if (convoRootBtn) {
    convoRootBtn.addEventListener('click', () => {
      if (currentConvoId !== null) {
        loadEntriesForConversation(currentConvoId, false)
        updateMobileNavButtons()
      }
    })
  }
}

function setupMobileNavigation() {
  if (!mobileNavBtn || !mobileNavPanel || !mobileNavOverlay) return

  // Open navigation panel
  mobileNavBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    mobileNavOverlay.style.display = 'block'
    mobileNavPanel.style.display = 'flex'
  })

  // Close navigation panel when clicking overlay
  mobileNavOverlay.addEventListener('click', () => {
    mobileNavOverlay.style.display = 'none'
    mobileNavPanel.style.display = 'none'
  })

  // Home navigation
  if (mobileNavHome) {
    mobileNavHome.addEventListener('click', (e) => {
      e.preventDefault()
      goBackHomeWithBrowserHistory()
      mobileNavOverlay.style.display = 'none'
      mobileNavPanel.style.display = 'none'
    })
  }

  // Settings navigation
  if (mobileNavSettings) {
    mobileNavSettings.addEventListener('click', (e) => {
      e.preventDefault()
      if (settingsBtn) settingsBtn.click()
      mobileNavOverlay.style.display = 'none'
      mobileNavPanel.style.display = 'none'
    })
  }

  // Search navigation
  if (mobileNavSearch) {
    mobileNavSearch.addEventListener('click', (e) => {
      e.preventDefault()
      if (mobileSearchTrigger) {
        mobileSearchTrigger.click()
      }
      mobileNavOverlay.style.display = 'none'
      mobileNavPanel.style.display = 'none'
    })
  }
}

function updateMobileNavButtons() {
  if (!backBtn || !convoRootBtn) return

  // Show back button if we have navigation history OR if we're not on home view
  if (
    navigationHistory.length > 1 ||
    currentConvoId !== null ||
    currentAppState !== 'home'
  ) {
    backBtn.disabled = false
    convoRootBtn.disabled = false
  } else {
    backBtn.disabled = true
    convoRootBtn.disabled = true
  }
}

function closeAllSidebars() {
  closeConversationSection()
  closeHistorySidebar()
}

function performMobileSearch(resetSearch = true) {
  const query = mobileSearchInput?.value?.trim() ?? ''
  mobileSearchTrigger.value = query
  if (resetSearch) {
    // Starting a new search
    mobileSearchQuery = query
    mobileSearchActorIds =
      mobileSelectedActorIds.size === 0 ||
        mobileSelectedActorIds.size === allActors.length
        ? null
        : Array.from(mobileSelectedActorIds)
    mobileSearchOffset = 0
    mobileSearchLoader?.classList.remove('hidden')
    if (mobileSearchResults) {
      mobileSearchResults.innerHTML = ''
    }
  }

  if (isMobileLoadingMore) return
  isMobileLoadingMore = true

  try {
    
    // Advanced search: include/only variables via dropdown selection
    let variableResults = []
    if (appSettings.includeVariables) {
      const varResp = DB.searchVariables(currentSearchQuery, searchResultLimit, currentSearchOffset, wholeWordsCheckbox?.checked || false)
      variableResults = varResp.results
      if (!appSettings.includeDialogue) {
        // Render variables only
        entryListHeaderEl.textContent = 'Search Results (Variables)'
        entryListEl.innerHTML = ''
        variableResults.forEach(v => {
          const div = document.createElement('div')
          div.className = 'card-item result-item'
          const title = document.createElement('div')
          title.className = 'card-title'
          title.textContent = v.name || `(variable #${v.id})`
          const body = document.createElement('div')
          body.className = 'card-body'
          body.textContent = v.description || '(no description)'
          div.appendChild(title)
          div.appendChild(body)
          entryListEl.appendChild(div)
        })
        isLoadingMore = false
        searchLoader?.classList.add('hidden')
        return
      }
    }

    const response = DB.searchDialogues(
      mobileSearchQuery,
      searchResultLimit,
      mobileSearchActorIds,
      true,
      mobileSearchOffset,
      undefined, // conversationIds
      mobileWholeWordsCheckbox?.checked || false // wholeWords
    )
    const { results, total } = response
    mobileSearchTotal = total

    // Filter by conversations if selected
    let filteredResults = results
    if (mobileSelectedConvoIds.size > 0) {
      filteredResults = results.filter((r) =>
        mobileSelectedConvoIds.has(r.conversationid)
      )
    }

    // Filter by type if not "all"
    if (!mobileSelectedTypes.has('all')) {
      filteredResults = filteredResults.filter((r) => {
        const convo = DB.getConversationById(r.conversationid)
        return convo && mobileSelectedTypes.has(convo.type || 'flow')
      })
    }

    mobileSearchLoader?.classList.add('hidden')

    if (resetSearch) {
      mobileSearchFilteredCount = 0
    }

    if (resetSearch && filteredResults.length === 0 && variableResults.length === 0) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">No results found</div>'
      if (mobileSearchCount) {
        mobileSearchCount.style.display = 'none'
      }
      return
    }

    // Update filtered count
    mobileSearchFilteredCount += filteredResults.length

    // Update count display
    if (mobileSearchCount) {
      if (mobileSelectedConvoIds.size > 0 || !mobileSelectedTypes.has('all')) {
        // Show filtered count when filters are active
        mobileSearchCount.textContent = `${mobileSearchFilteredCount} results (filtered)`
      } else {
        // Show total count when no filters
        mobileSearchCount.textContent = `${mobileSearchFilteredCount} of ${total} results`
      }
      mobileSearchCount.style.display = 'block'
    }

    // Append variables to results if includeVariables && includeDialogue
      variableResults.forEach((v) => {
        const hasQuotedPhrases = /"[^"]+"/g.test(mobileSearchQuery)
        const highlightedName = UI.highlightTerms(v.name || '', mobileSearchQuery, hasQuotedPhrases)
        const highlightedDesc = UI.highlightTerms(v.description || '', mobileSearchQuery, hasQuotedPhrases)

        const div = document.createElement('div')
        div.className = 'card-item result-item'
        div.style.cursor = 'default'

        const title = document.createElement('div')
        title.className = 'card-title'
        title.innerHTML = highlightedName || '(variable)'

        const body = document.createElement('div')
        body.className = 'card-body'
        body.innerHTML = highlightedDesc || '(no description)'

        div.appendChild(title)
        div.appendChild(body)
        mobileSearchResults.appendChild(div)
      })

    filteredResults.forEach((r) => {
      // Check if query contains any quoted phrases
      const hasQuotedPhrases = /"[^"]+"/g.test(mobileSearchQuery)

      const highlightedTitle = UI.highlightTerms(
        r.title || '',
        mobileSearchQuery,
        hasQuotedPhrases
      )
      const highlightedText = UI.highlightTerms(
        r.dialoguetext || '',
        mobileSearchQuery,
        hasQuotedPhrases
      )

      // Get conversation type for badge
      const convo = DB.getConversationById(r.conversationid)
      const convoType = convo ? convo.type || 'flow' : 'flow'

      const div = UI.createCardItem(
        highlightedTitle,
        UI.getParsedIntOrDefault(r.conversationid),
        r.id,
        highlightedText,
        true,
        convoType
      )

      div.addEventListener('click', () => {
        // Check if this is an orb/task (cid === eid means conversation root for orbs/tasks)
        const cid = UI.getParsedIntOrDefault(r.conversationid)
        const eid = r.id

        if (cid === eid) {
          // This is an orb or task - load the conversation root

          loadEntriesForConversation(cid, true)
        } else {
          // This is a regular dialogue entry or alternate
          // If this is an alternate, pass the condition and alternate line

          const alternateCondition = r.isAlternate
            ? r.alternatecondition
            : null
          const alternateLine = r.isAlternate ? r.dialoguetext : null
          navigateToEntry(cid, eid, true, alternateCondition, alternateLine)
        }

        // Close mobile search and return to main view
        closeMobileSearchScreen()
      })

      mobileSearchResults.appendChild(div)
    })

    // Update offset for next load (based on database results, not filtered)
    mobileSearchOffset += results.length

    // Remove any existing loading indicator
    mobileSearchLoader?.classList.add('hidden')

    // Add loading indicator if there are more results in the database and we got results this time
    if (results.length > 0 && mobileSearchOffset < mobileSearchTotal) {
      mobileSearchLoader?.classList.remove('hidden')
    }
  } catch (e) {
    console.error('Mobile search error:', e)
    mobileSearchLoader?.classList.add('hidden')
    if (resetSearch) {
      mobileSearchResults.innerHTML =
        '<div class="mobile-search-prompt">Error performing search</div>'
    }
  } finally {
    isMobileLoadingMore = false
    mobileSearchLoader?.classList.add('hidden')
  }
}

function showMobileConvoFilter() {
  if (!mobileConvoFilterScreen) return

  if (window.refreshMobileConvoList) {
    window.refreshMobileConvoList()
  }
  mobileConvoFilterScreen.style.display = 'block'
}

function showMobileActorFilter() {
  if (!mobileActorFilterScreen) return

  // Reset temporary selection to current selection when opening
  tempSelectedActorIds = new Set(mobileSelectedActorIds)

  // Re-render the actor list with current selection
  const listContainer = $('mobileActorFilterList')
  if (listContainer) {
    renderActorListForMobile(allActors)
  }

  mobileActorFilterScreen.style.display = 'block'
}

function showMobileTypeFilter() {
  if (!mobileTypeFilterSheet) return

  mobileTypeFilterSheet.style.display = 'block'
  mobileTypeFilterSheet.classList.add('active')
}

function setupMobileConvoFilter() {
  const backBtn = $('mobileConvoFilterBack')
  const searchInput = $('mobileConvoFilterSearch')
  const listContainer = $('mobileConvoFilterList')
  const selectAllCheckbox = $('mobileConvoSelectAll')
  const addToSelectionBtn = $('mobileConvoAddToSelection')

  // Skip setup if any required elements are missing (indicates refactored HTML)
  if (!backBtn || !searchInput || !listContainer) {
    return
  }

  let tempSelectedConvoIds = new Set(mobileSelectedConvoIds)
  let allConvos = []
  let filteredConvos = []

  // Back button - don't apply changes
  backBtn.addEventListener('click', () => {
    mobileConvoFilterScreen.style.display = 'none'
    tempSelectedConvoIds = new Set(mobileSelectedConvoIds)
  })

  // Add to Selection button - apply changes
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener('click', () => {
      mobileSelectedConvoIds = new Set(tempSelectedConvoIds)
      updateMobileConvoFilterLabel()
      mobileConvoFilterScreen.style.display = 'none'
      // Trigger new search with updated filter
      if (mobileSearchInput.value.trim()) {
        performMobileSearch()
      }
    })
  }

  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered convos
        filteredConvos.forEach((c) => tempSelectedConvoIds.add(c.id))
      } else {
        // Deselect all filtered convos
        filteredConvos.forEach((c) => tempSelectedConvoIds.delete(c.id))
      }
      renderConvoList(filteredConvos)
    })
  }

  // Render conversation list
  function renderConvoList(conversations) {
    listContainer.innerHTML = ''
    filteredConvos = conversations

    // Update Select All checkbox state
    if (selectAllCheckbox) {
      const allSelected =
        conversations.length > 0 &&
        conversations.every((c) => tempSelectedConvoIds.has(c.id))
      const someSelected = conversations.some((c) =>
        tempSelectedConvoIds.has(c.id)
      )
      selectAllCheckbox.checked = allSelected
      selectAllCheckbox.indeterminate = someSelected && !allSelected
    }

    // Add conversation items
    conversations.forEach((convo) => {
      const item = document.createElement('div')
      item.className = 'mobile-filter-item'
      const isChecked = tempSelectedConvoIds.has(convo.id)
      item.innerHTML = `
        <input type="checkbox" ${isChecked ? 'checked' : ''} />
        <span>${convo.displayTitle || `Conversation ${convo.id}`}</span>
      `
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input[type="checkbox"]')
          checkbox.checked = !checkbox.checked
        }

        const checkbox = item.querySelector('input[type="checkbox"]')
        if (checkbox.checked) {
          tempSelectedConvoIds.add(convo.id)
        } else {
          tempSelectedConvoIds.delete(convo.id)
        }

        // Update Select All checkbox
        if (selectAllCheckbox) {
          const allSelected = filteredConvos.every((c) =>
            tempSelectedConvoIds.has(c.id)
          )
          const someSelected = filteredConvos.some((c) =>
            tempSelectedConvoIds.has(c.id)
          )
          selectAllCheckbox.checked = allSelected
          selectAllCheckbox.indeterminate = someSelected && !allSelected
        }
      })
      listContainer.appendChild(item)
    })
  }

  // Initial render
  allConvos = DB.getAllConversations()
  renderConvoList(allConvos)

  // Expose refresh function
  window.refreshMobileConvoList = () => {
    allConvos = DB.getAllConversations()

    tempSelectedConvoIds = new Set(mobileSelectedConvoIds)
    searchInput.value = ''
    renderConvoList(allConvos)
  }

  // Search filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim()
    if (!query) {
      renderConvoList(allConvos)
      return
    }

    const filtered = allConvos.filter((c) => {
      return (
        (c.displayTitle || '').toLowerCase().includes(query) ||
        c.id.toString().includes(query)
      )
    })

    renderConvoList(filtered)
  })
}

function updateMobileConvoFilterLabel() {
  if (!mobileConvoFilterValue) return

  if (mobileSelectedConvoIds.size === 0) {
    mobileConvoFilterValue.textContent = 'All'
  } else if (mobileSelectedConvoIds.size === 1) {
    const convoId = Array.from(mobileSelectedConvoIds)[0]
    const allConvos = DB.getAllConversations()
    const convo = allConvos.find((c) => c.id === convoId)
    mobileConvoFilterValue.textContent = convo
      ? convo.displayTitle || `#${convo.id}`
      : '1 Convo'
  } else {
    mobileConvoFilterValue.textContent = `${mobileSelectedConvoIds.size} Convos`
  }
}

// Render mobile actor list (used by setupMobileActorFilter and showMobileActorFilter)
function renderActorListForMobile(actors) {
  const listContainer = $('mobileActorFilterList')
  const selectAllCheckbox = $('mobileActorSelectAll')

  if (!listContainer) return

  listContainer.innerHTML = ''
  filteredActorsForMobile = actors

  // Update Select All checkbox state
  if (selectAllCheckbox) {
    const allSelected =
      actors.length > 0 && actors.every((a) => tempSelectedActorIds.has(a.id))
    const someSelected = actors.some((a) => tempSelectedActorIds.has(a.id))
    selectAllCheckbox.checked = allSelected
    selectAllCheckbox.indeterminate = someSelected && !allSelected
  }

  // Add actor items
  actors.forEach((actor) => {
    const item = document.createElement('div')
    item.className = 'mobile-filter-item'
    const isChecked = tempSelectedActorIds.has(actor.id)
    item.innerHTML = `
      <input type="checkbox" ${isChecked ? 'checked' : ''} />
      <span>${actor.name}</span>
    `
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = item.querySelector('input[type="checkbox"]')
        checkbox.checked = !checkbox.checked
      }

      const checkbox = item.querySelector('input[type="checkbox"]')
      if (checkbox.checked) {
        tempSelectedActorIds.add(actor.id)
      } else {
        tempSelectedActorIds.delete(actor.id)
      }

      // Update Select All checkbox
      if (selectAllCheckbox) {
        const allSelected = filteredActorsForMobile.every((a) =>
          tempSelectedActorIds.has(a.id)
        )
        const someSelected = filteredActorsForMobile.some((a) =>
          tempSelectedActorIds.has(a.id)
        )
        selectAllCheckbox.checked = allSelected
        selectAllCheckbox.indeterminate = someSelected && !allSelected
      }
    })
    listContainer.appendChild(item)
  })
}

function setupMobileActorFilter() {
  const backBtn = $('mobileActorFilterBack')
  const searchInput = $('mobileActorFilterSearch')
  const selectAllCheckbox = $('mobileActorSelectAll')
  const addToSelectionBtn = $('mobileActorAddToSelection')

  if (!backBtn || !searchInput) return

  // Initialize temp selection
  tempSelectedActorIds = new Set(mobileSelectedActorIds)

  // Back button - don't apply changes
  backBtn.addEventListener('click', () => {
    mobileActorFilterScreen.style.display = 'none'
    tempSelectedActorIds = new Set(mobileSelectedActorIds)
  })

  // Add to Selection button - apply changes
  if (addToSelectionBtn) {
    addToSelectionBtn.addEventListener('click', () => {
      mobileSelectedActorIds = new Set(tempSelectedActorIds)
      updateMobileActorFilterLabel()
      mobileActorFilterScreen.style.display = 'none'
      // Trigger new search with updated filter
      if (mobileSearchInput.value.trim()) {
        performMobileSearch(true)
      }
    })
  }

  // Select All checkbox
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        // Select all filtered actors
        filteredActorsForMobile.forEach((a) => tempSelectedActorIds.add(a.id))
      } else {
        // Deselect all filtered actors
        filteredActorsForMobile.forEach((a) =>
          tempSelectedActorIds.delete(a.id)
        )
      }
      renderActorListForMobile(filteredActorsForMobile)
    })
  }

  // Initial render
  renderActorListForMobile(allActors)

  // Search filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim()
    if (!query) {
      renderActorListForMobile(allActors)
      return
    }

    const filtered = allActors.filter((a) => {
      return (
        a.name.toLowerCase().includes(query) || a.id.toString().includes(query)
      )
    })
    renderActorListForMobile(filtered)
  })
}

function updateMobileActorFilterLabel() {
  if (!mobileActorFilterValue) return

  if (mobileSelectedActorIds.size === 0) {
    mobileActorFilterValue.textContent = 'All'
  } else if (mobileSelectedActorIds.size === 1) {
    const actorId = Array.from(mobileSelectedActorIds)[0]
    const actor = allActors.find((a) => a.id === actorId)
    mobileActorFilterValue.textContent = actor ? actor.name : '1 Actor'
  } else {
    mobileActorFilterValue.textContent = `${mobileSelectedActorIds.size} Actors`
  }
}

function updateMobileTypeFilterLabel() {
  if (!mobileTypeFilterValue) return

  if (mobileSelectedTypes.has('all') || mobileSelectedTypes.size === 0) {
    mobileTypeFilterValue.textContent = 'All'
  } else if (mobileSelectedTypes.size === 1) {
    const type = Array.from(mobileSelectedTypes)[0]
    mobileTypeFilterValue.textContent =
      type.charAt(0).toUpperCase() + type.slice(1)
  } else {
    mobileTypeFilterValue.textContent = `${mobileSelectedTypes.size} Types`
  }
}

function setupMobileTypeFilter() {
  // Skip setup if required elements are missing (indicates refactored HTML)
  if (!mobileTypeFilterSheet) return

  const applyBtn = $('mobileTypeApply')
  const checkboxes = mobileTypeFilterSheet.querySelectorAll(
    'input[type="checkbox"]'
  )

  if (!applyBtn) return

  // Close sheet when clicking outside content
  mobileTypeFilterSheet.addEventListener('click', (e) => {
    if (e.target === mobileTypeFilterSheet) {
      mobileTypeFilterSheet.style.display = 'none'
      mobileTypeFilterSheet.classList.remove('active')
    }
  })

  // Handle "All" checkbox behavior
  checkboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const type = cb.dataset.type

      if (type === 'all' && cb.checked) {
        // Check all others when "All" is checked
        checkboxes.forEach((otherCb) => {
          otherCb.checked = true
        })
      } else if (type === 'all' && !cb.checked) {
        // Uncheck all others when "All" is unchecked
        checkboxes.forEach((otherCb) => {
          otherCb.checked = false
        })
      } else if (type !== 'all') {
        // If a specific type is checked/unchecked, update "All" checkbox
        const allCheckbox = mobileTypeFilterSheet.querySelector(
          'input[data-type="all"]'
        )
        const specificCheckboxes = Array.from(checkboxes).filter(
          (cb) => cb.dataset.type !== 'all'
        )
        const allSpecificChecked = specificCheckboxes.every((cb) => cb.checked)
        const anySpecificChecked = specificCheckboxes.some((cb) => cb.checked)

        if (allCheckbox) {
          allCheckbox.checked = allSpecificChecked
          allCheckbox.indeterminate = anySpecificChecked && !allSpecificChecked
        }
      }
    })
  })

  // Apply button
  applyBtn.addEventListener('click', () => {
    mobileSelectedTypes.clear()

    checkboxes.forEach((cb) => {
      if (cb.checked) {
        mobileSelectedTypes.add(cb.dataset.type)
      }
    })

    // Update label
    updateMobileTypeFilterLabel()

    // Close sheet
    mobileTypeFilterSheet.style.display = 'none'
    mobileTypeFilterSheet.classList.remove('active')

    // Perform search if there's a query
    if (mobileSearchInput.value.trim()) performMobileSearch()
  })
}

/* Icon Initialization */
function initializeIcons() {
  // Helper function to clone and size an icon template
  function getIcon(templateId, width = '30px', height = '30px') {
    const template = document.getElementById(templateId)
    const clone = template.content.cloneNode(true)
    const svg = clone.querySelector('svg')
    svg.setAttribute('width', width)
    svg.setAttribute('height', height)
    return clone
  }

  // Apply icons for any placeholder with data-icon-template
  const dataPlaceholders = document.querySelectorAll(
    '.icon-placeholder[data-icon-template]'
  )

  dataPlaceholders.forEach((placeholder) => {
    const templateId = placeholder.dataset.iconTemplate
    if (!templateId) return
    const iconWidth = placeholder.dataset.iconWidth || placeholder.dataset.iconSize || '30px'
    const iconHeight = placeholder.dataset.iconHeight || placeholder.dataset.iconSize || iconWidth
    const iconClone = getIcon(templateId, iconWidth, iconHeight)
    placeholder.replaceWith(...iconClone.childNodes)
  })
}

/* Initialize boot sequence */
boot().catch((err) => console.error('boot error', err))
