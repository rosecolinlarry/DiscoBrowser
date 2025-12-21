# DiscoBrowser

Heavily inspired by [FAYDE Playback Experiment: On-Air](https://fayde.co.uk/).


## Overview

Disco Browser is a lightweight, browser-based tool for exploring and searching Disco Elysium dialogue data stored in an SQLite database. Hosted by GitHub pages, visit the site here: https://rosecolinlarry.github.io/DiscoBrowser/.

## Purpose

I created this to be my own personal version of [Fayde](https://fayde.co.uk/) as the website is often down and sometimes I just get the hankering to read some good Moralist lore. While my intention is to offer the functionality of FAYDE, and much of the features are based off of it, there are missing features and also unique components. I believe it also includes more of the orbs than the Fayde contemplate orbs page.

One bonus is you can quickly search the entire database of dialogue from the game. Just hit the search button without any search text entered. Results should appear within a second.

Note: There are some dialogue that is in the game files but not presented in game and/or are test conversations included by the developers. I am working on trying to hide anything that is not in the game from the conversation tree. You can see them by toggling the show hidden conversation setting.

## Main Features

- **Conversation explorer**
  - Browse conversations in a collapsible, hierarchical tree built from conversation titles.
  - Type badges highlight conversation kinds (flows, orbs, tasks, etc.).
  - Resize this column by hovering over the right side and dragging (similar to file explorer)
- **Simple Search**
  - Search dialogue text and variable text with support for:
  - Quoted phrase searches
  - Whole-word toggle
  - Actor-scoped search
  - Pagination / “load more” (search limits)
- **Filters and scopes**
  - Filter search results by actor, conversation types (flow/orb/task), and/or specific conversations
  - Select / deselect all actors/types for quick narrowing/widening.
- **Detail view for entries**
  - Render entry overview and full details including:
  - Alternates (alternate lines and conditions)
  - Checks (skills, difficulty)
  - Parents / children links (dlinks)
  - Entry and conversation metadata tables
- **History & navigation**
  - Navigation history (chat log) with back / root navigation to re-open conversations and entries.
  - Can also use the browser's navigation buttons
  - Also able to be resized by dragging the left side of the column
- **Mobile  experience**
  - Dedicated mobile search screen, mobile filter screens, and a bottom-sheet type picker.
  - Does not support resizing the columns
- **Settings**
  - UI preferences: disable animations, reset layout, show hidden conversations, toggle resizing, etc.
- **Static Site - No Server**
  - Runs entirely in the browser using the included sql-wasm engine to read a local SQLite DB (no server dependency required)
  - Single page website
- **Performance & caching**
  - Entry-level caching, batched queries, and lazy/iterative tree rendering to keep UI responsive.

## Generating the Database

To re-generate the sqlite3 file, extract the game file from the decompiled game and run the file `parse_disco_json.py` (update it to point to the paths of your files). Then run the scripts in `migrations` in order.

### Getting the game data file

Instructions for desktop downloaded via Steam.

1. Install Disco Elysium
2. Copy the `discoData` folder from your steam library game download location (e.g. `SteamLibrary\steamapps\common\Disco Elysium\disco_Data`
3. Decompile the game with Asset Ripper
4. From the extracted assets, find `\disco_Data\StreamingAssets\aa\StandaloneWindows64\MonoBehaviour\Disco Elysium.json`
5. Run the parse_disco_json.py on the `Disco Elysium.json`
6. Run the scripts in `migrations` in order.

## Installation & Usage

- Place the conversation database file at discobase.sqlite3 (or update path in initDatabase).
- Serve the folder over a local static server (recommended) or open index.html in a browser that permits loading WASM from file:
  - Example: `python -m http.server 8000` (serve from project root) or npx http-server
- Open http://localhost:8000 (or the file URL) and use the search box, filters, or the conversation tree to explore entries.

## Behavior notes & implementation details

1. Search supports quoted phrases and multi-word queries; use the Whole Words option for stricter matches.
2. Results show a snippet card (title + meta + highlighted snippet); clicking opens the entry overview and details.
3. Conversation tree is built from conversation titles split on / and collapsed for readability.
4. The app includes Google Analytics / Tag Manager scripts in index.html (opt out by removing the snippet if desired).


## Roadmap & Future Work

### What's Next

- Improve styling
  - Add color coding to the speaker's names
  - Have the checkboxes in the settings modal and dropdown filters be consistent
  - Improve overall UI/UX
  - Consolidate the mobile UI and desktop UI elements
- Sorting
  - Add sorting to the search results
  - Add sorting to the filter dropdowns
    - Allow ordering actors by talkativeness
- Searching
  - Add ability to enter exact dialogue id and convo id
- Variables
  - Show variable descriptions on hover

### Planned Future Work

- Support translations
  - Include the translated lines for the entries
- Tasks
  - Add subtasks
  - Remove nesting when filtering only by tasks in the conversation view
- Orbs
  - Add location filter for orbs
  - Add color coding to the orbs based on skill type
- Variables
  - Add ability to search by variables
- Easier way to copy/paste entries

### Potential Future Work

- Permalinks / deep linking to conversation/entry
- Keyboard navigation & improved accessibility (a11y)
- Reinvestigate FTS5 searching and fuzzy search
- Autocomplete for filters
- Debounce searching
- Add better game resemblance
- Search query builder
- Export features for search results
