# PRD: FoxWQ Game Record Fetcher & Local Loader

## 1. Goal
Implement a "FoxWQ Game Import" feature within Sabaki. Users can input a FoxWQ User UID to fetch a list of recent public games, select a game to download its SGF, and load it into the Sabaki board for review or analysis.

The core loop:
1. Input FoxWQ UID.
2. Fetch game list.
3. Display game metadata.
4. User selects a game.
5. Download SGF.
6. Import to local board.
7. Enter Review/Analysis mode.

## 2. Scope

### V1 (Core Features)
- Support UID input.
- Call FoxWQ H5 game list API.
- Display a list of recent public games.
- Support selecting a specific game.
- Download SGF based on `chessid`.
- Load SGF into the current Sabaki board.
- Basic error handling (network, invalid UID, empty list).

### Out of Scope for V1
- No login required (public data only).
- No bypassing of permissions, CAPTCHAs, or private game restrictions.
- No batch downloads.
- No cloud synchronization.
- No full-scale game database management.
- No real-time synchronization of ongoing games.

## 3. Frontend Contract Dependency

This feature should start from the shared Management Hub UI contract branch/worktree.

Before FoxWQ network work begins, the following frontend decisions should already be fixed:

- `FoxGamePane` component location and public props/events.
- Search form fields and action names.
- Result table columns.
- Selected-game detail shape.
- Loading, empty, error, and selected-row states.
- Bottom action bar button placement.

The FoxWQ feature worktree owns service/store/data-flow implementation. It should avoid redesigning the Management Hub shell or changing shared sidebar behavior unless the shared UI contract is updated first.

## 4. User Scenarios

### Scenario 1: Fetching Recent Games by UID
A user knows a FoxWQ UID (e.g., `35020143`). They enter it in the "Fox Games" panel, click "Search," and see a list of recent public games played by that user.

### Scenario 2: Selecting and Loading a Game
The user browses the list, seeing details like:
- Black/White players (names and ranks)
- Result
- Date
- Move count
- `chessid`
They click "Open in Local Board," and Sabaki downloads the SGF and opens it.

### Scenario 3: Error Handling
If the UID is invalid, the list is empty, or the SGF fails to download/parse, the system provides clear feedback instead of failing silently.

## 5. API Specification

### 5.1 Fetch Game List
**URL**: `https://h5.foxwq.com/yehuDiamond/chessbook_local/YHWQFetchChessList?srcuid=0&dstuid={uid}&type=1&lastcode={lastcode}&searchkey=&uin={uid}`

**Parameters**:
- `srcuid=0`: Source UID (0 for non-logged-in).
- `dstuid`: Target User UID.
- `type=1`: Game type (fixed for V1).
- `lastcode=0`: Pagination cursor (0 for first page).
- `uin`: Same as `dstuid`.

### 5.2 Fetch SGF
**URL**: `https://h5.foxwq.com/yehuDiamond/chessbook_local/YHWQFetchChess?chessid={chessid}`

**Output**: SGF content (may be wrapped in JSON).

## 6. Technical Architecture

The implementation follows the established Service/Store/Component pattern in Sabaki:

### 6.1 FoxGameFetchService (`src/modules/fox/foxGameFetchService.js`)
Responsible for all network requests to FoxWQ APIs.
- `fetchGameListByUid(uid, lastcode)`
- `fetchSgfByChessId(chessid)`

### 6.2 FoxGameStore (`src/modules/fox/foxGameStore.js`)
Manages the state of the Fox Games panel.
- `uidInput`: The current value of the UID input field.
- `games`: Array of game metadata objects.
- `loadingList`: Boolean.
- `loadingSgf`: Boolean.
- `error`: Error message if any.
- `selectedChessId`: The ID of the currently highlighted game in the list.

### 6.3 SgfImportService (`src/modules/fox/sgfImportService.js`)
Handles the logic of taking an SGF string and importing it into `documentStore`.
- `importFromSgfText(sgf)`: Prompts user if there are unsaved changes before replacing current game.

### 6.4 Components
- `FoxGamePane` (`src/components/management/FoxGamePane.js`): The main Management Hub pane.
- `FoxGameList`: Renders the table of games.
- `FoxGameDetail`: Shows detailed info and preview of the selected game.

## 7. Data Flow
1. **Fetch**: UI triggers `FoxGameStore.loadGameList` -> `FoxGameFetchService.fetchGameListByUid` -> Update `FoxGameStore.games`.
2. **Import**: UI triggers `FoxGameStore.importGame` -> `FoxGameFetchService.fetchSgfByChessId` -> `SgfImportService.importFromSgfText` -> `documentStore` updates.

## 8. Success Criteria
- Successfully fetch and display games for UID `35020143`.
- Successfully download and load a game into Sabaki.
- Proper handling of network failures.
- Confirmation dialog when importing if the current game is unsaved.
