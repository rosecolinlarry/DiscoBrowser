// icons.js - Icon template definitions
// This file contains all SVG icon templates used throughout the application

/**
 * Creates and injects icon templates into the DOM
 * Templates are stored in <template> elements for efficient cloning
 */
export function injectIconTemplates() {
  const iconTemplatesHTML = `
    <template id="icon-back-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m330-444 201 201-51 51-288-288 288-288 51 51-201 201h438v72H330Z"/>
        </svg>
    </template>
    <template id="icon-close-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m291-240-51-51 189-189-189-189 51-51 189 189 189-189 51 51-189 189 189 189-51 51-189-189-189 189Z"/>
        </svg>
    </template>
    <template id="icon-search-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M765-144 526-383q-30 22-65.79 34.5-35.79 12.5-76.18 12.5Q284-336 214-406t-70-170q0-100 70-170t170-70q100 0 170 70t70 170.03q0 40.39-12.5 76.18Q599-464 577-434l239 239-51 51ZM384-408q70 0 119-49t49-119q0-70-49-119t-119-49q-70 0-119 49t-49 119q0 70 49 119t119 49Z"/>
        </svg>
    </template>
    <template id="icon-menu-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M90.67-210.67v-104.66h533.66v104.66H90.67ZM797-262 586-480.67l210.33-218 73.67 75-137 143 137.67 144L797-262ZM90.67-429v-104.67h420V-429h-420Zm0-216.33V-750h533.66v104.67H90.67Z"/>
        </svg>
    </template>
    <template id="icon-home-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M264-216h96v-240h240v240h96v-348L480-726 264-564v348Zm-72 72v-456l288-216 288 216v456H528v-240h-96v240H192Zm288-327Z"/>
        </svg>
    </template>
    <template id="icon-github-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
    </template>
    <template id="icon-undo-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M288-192v-72h288q50 0 85-35t35-85q0-50-35-85t-85-35H330l93 93-51 51-180-180 180-180 51 51-93 93h246q80 0 136 56t56 136q0 80-56 136t-136 56H288Z"/>
        </svg>
    </template>
    <template id="icon-restart-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M444-144q-107-14-179.5-94.5T192-430q0-61 23-113.5t63-91.5l51 51q-30 29-47.5 69T264-430q0 81 51.5 140T444-217v73Zm72 0v-73q77-13 128.5-72.5T696-430q0-90-63-153t-153-63h-7l46 46-51 50-132-132 132-132 51 51-45 45h6q120 0 204 84t84 204q0 111-72.5 192T516-144Z"/>
        </svg>
    </template>
    <template id="icon-arrow-drop-down-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M480-360 280-559.33h400L480-360Z"/>
        </svg>
    </template>
        <template id="icon-arrow-drop-up-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m280-400 200-200.67L680-400H280Z"/>
        </svg>
    </template>
    <template id="icon-expand-all-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M480-80 240-320l48.33-48.33L480-176.67l191.67-191.66L720-320 480-80ZM288.67-592 240-640l240-240 240 240-48.67 48L480-783.33 288.67-592Z"/>
        </svg>
    </template>
    <template id="icon-collapse-all-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M292-83.33 245.33-130 480-364.67 714.67-130 668-83.33l-188-188-188 188ZM480-596 245.33-830.67 292-877.33l188 188 188-188 46.67 46.66L480-596Z"/>
            </svg>
    </template>
    <template id="icon-chevron-right-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M521.33-480.67 328-674l47.33-47.33L616-480.67 375.33-240 328-287.33l193.33-193.34Z"/>   
        </svg>
    </template>
    <template id="icon-arrow-right-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M400-280v-400l200 200-200 200Z"/>
        </svg>
    </template>
    <template id="icon-settings-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="m382-80-18.67-126.67q-17-6.33-34.83-16.66-17.83-10.34-32.17-21.67L178-192.33 79.33-365l106.34-78.67q-1.67-8.33-2-18.16-.34-9.84-.34-18.17 0-8.33.34-18.17.33-9.83 2-18.16L79.33-595 178-767.67 296.33-715q14.34-11.33 32.34-21.67 18-10.33 34.66-16L382-880h196l18.67 126.67q17 6.33 35.16 16.33 18.17 10 31.84 22L782-767.67 880.67-595l-106.34 77.33q1.67 9 2 18.84.34 9.83.34 18.83 0 9-.34 18.5Q776-452 774-443l106.33 78-98.66 172.67-118-52.67q-14.34 11.33-32 22-17.67 10.67-35 16.33L578-80H382Zm55.33-66.67h85l14-110q32.34-8 60.84-24.5T649-321l103.67 44.33 39.66-70.66L701-415q4.33-16 6.67-32.17Q710-463.33 710-480q0-16.67-2-32.83-2-16.17-7-32.17l91.33-67.67-39.66-70.66L649-638.67q-22.67-25-50.83-41.83-28.17-16.83-61.84-22.83l-13.66-110h-85l-14 110q-33 7.33-61.5 23.83T311-639l-103.67-44.33-39.66 70.66L259-545.33Q254.67-529 252.33-513 250-497 250-480q0 16.67 2.33 32.67 2.34 16 6.67 32.33l-91.33 67.67 39.66 70.66L311-321.33q23.33 23.66 51.83 40.16 28.5 16.5 60.84 24.5l13.66 110Zm43.34-200q55.33 0 94.33-39T614-480q0-55.33-39-94.33t-94.33-39q-55.67 0-94.5 39-38.84 39-38.84 94.33t38.84 94.33q38.83 39 94.5 39ZM480-480Z"/>
        </svg>
    </template>
    <template id="icon-text-select-jump-to-beginning-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
          <path d="M773.33-773.33V-840H840v66.67h-66.67Zm0 653.33v-66.67H840V-120h-66.67ZM610-773.33V-840h66.67v66.67H610ZM610-120v-66.67h66.67V-120H610ZM446.67-773.33V-840h66.66v66.67h-66.66Zm-163.34 0V-840H350v66.67h-66.67Zm0 653.33v-66.67H350V-120h-66.67ZM120-120v-720h66.67v720H120Zm429.33-209.33L398.67-480l150.66-150.67L596-584l-69.67 70.67H840v66.66H526.33L596-376l-46.67 46.67ZM446.67-120v-66.67h66.66V-120h-66.66Z"/>
        </svg>
    </template>
    <template id="icon-left-panel-open-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
          <path d="M516-651.67V-309l172-171-172-171.67Zm-319.33 561q-44.2 0-75.1-30.9-30.9-30.9-30.9-75.1v-566.66q0-44.48 30.9-75.57 30.9-31.1 75.1-31.1h566.66q44.48 0 75.57 31.1 31.1 31.09 31.1 75.57v566.66q0 44.2-31.1 75.1-31.09 30.9-75.57 30.9H196.67Zm121.33-106v-566.66H196.67v566.66H318Zm106.67 0h338.66v-566.66H424.67v566.66Zm-106.67 0H196.67 318Z"/>
        </svg>
    </template>
    <template id="icon-help-template">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M478-240q21 0 35.5-14.5T528-290q0-21-14.5-35.5T478-340q-21 0-35.5 14.5T428-290q0 21 14.5 35.5T478-240Zm-36-154h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
        </svg>
    </template>
  `

  // Create a container element and add templates to it
  const container = document.createElement('div')
  container.innerHTML = iconTemplatesHTML
  document.body.insertBefore(container, document.body.firstChild)
}
