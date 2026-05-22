# UI/UX Design: FoxWQ Game Import Panel

## 1. Overview
The FoxWQ Game Import feature is integrated as a dedicated tab within the **Management Hub** (the new unified settings and management sidebar). This provides a clean, dual-pane layout for searching, previewing, and importing game records.

## 2. Layout Structure

### 2.1 Management Hub Entry
- A new icon (stylized Fox) is added to the Management Hub's left sidebar.
- Clicking this icon switches the Hub's content area to the **Fox Game Panel**.

### 2.2 Search Configuration (Top Section)
- **Title**: "FoxWQ History Import" (野狐历史对局导入) with a subtitle explaining the feature.
- **Fields**:
    - **Fox User UID**: Input field for the target UID.
    - **Sort Order**: Dropdown (e.g., "Latest First").
- **Action**: A prominent "Search History" button with a search icon.

### 2.3 Main View (Dual-Pane)
The main content is split into two columns:

#### Left Pane: Search Results
- **Table**: A scrollable list of games fetched from FoxWQ.
- **Columns**: Date, Black Player, White Player, Result, Move Count, `chessid`.
- **Interactions**:
    - Clicking a row selects the game and updates the right pane.
    - Highlight state for the selected row.
- **Footer**: Pagination controls (e.g., Page 1, 2, 3...) and a "Total Count" indicator.

#### Right Pane: Game Details & Preview
- **Header**: Detailed metadata for the selected game.
    - Player names with ranks (e.g., "7d", "6d").
    - Result (e.g., "B+R").
    - Date and Move count.
    - `chessid`.
- **Preview**: A small, read-only Go board showing the final state or a key moment (if available from metadata/SGF).
- **Actions**:
    - "Copy chessid": Copies the ID to the clipboard.
    - "Refresh List": Refetches the list for the current UID.

### 2.4 Action Bar (Bottom)
- **Primary Action**: "Open in Local Board" button. This is the most prominent element, usually located at the bottom right.

## 3. Visual Style & Aesthetics
- **Color Palette**: Follows Sabaki's design language—neutral backgrounds with clear accents (blue for primary actions).
- **Typography**: Uses modern sans-serif fonts consistent with the rest of the app.
- **Micro-interactions**:
    - Loading spinners for "Search" and "Open" actions.
    - Hover states for table rows and buttons.
    - Transition effects when switching between the result list and details.

## 4. Responsive Behavior
- The panel should be wide enough to accommodate the dual-pane layout comfortably.
- On smaller screens, it may switch to a single-pane vertical stack (Search -> Results -> Details).

## 5. Mockup Reference
![Mockup](https://files.oaiusercontent.com/file-XXXX) *(Refer to the provided design image for the exact visual layout)*
