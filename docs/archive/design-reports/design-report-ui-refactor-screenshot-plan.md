# Screenshot-first UI Refactor Plan

## Phase 2: Intent and Acceptance

The target is a screenshot-first recreation of the provided Sabaki UI. The two
`ui_refactor_guide*.txt` files are supporting guidance, but the screenshot is
the final visual reference.

Success means:

- The left and right sidebars read as macOS-style translucent inspector panels
  with soft card stacks.
- The bottom `EDIT WORKSPACE` dock is restyled to match the screenshot.
- The right Analysis card has real independent `Win rate` and `Score lead`
  toggles, and the chart renders both data series when enabled.
- Preview and Game Tree remain visible as separate right-sidebar cards.
- Styles stay scoped to the screenshot-related workspace areas and do not
  globally restyle drawers, preferences, game chooser, menus, or plain buttons.

In scope:

- Left sidebar: engine toolbar, current move row, `ENGINE LOGS` card,
  `MOVE LIST` card, and bottom toolbar.
- Right sidebar: `ANALYSIS`, `PREVIEW: REFERENCE`, and `GAME TREE` cards.
- Edit workspace dock: summary/status strip and edit tool buttons.
- Analysis chart data, interaction state, SVG rendering, and visual styling.

Out of scope:

- Replacing the main board texture, tatami texture, stone rendering, heatmap
  rendering, or move-value overlays.
- Reworking unrelated drawers, dialogs, menus, preference screens, or global
  controls.
- Adding broad utility CSS or styling classes that are not used by real
  components.

## Phase 3: Implementation Plan

Start from a clean CSS baseline. If any previous broad UI-refactor CSS returns,
remove it before implementing this plan.

### Right Sidebar and Analysis

- Replace the nested right-sidebar layout with a stable edit-workspace card
  stack when edit workspace is active: Analysis at the top, Preview in the
  middle, and Game Tree filling the remaining height.
- Keep existing `SplitContainer` behavior for non-edit modes unless a screenshot
  acceptance case requires the new card stack there too.
- Convert `WinrateGraph` into an Analysis card:
  - Header: `ANALYSIS` on the left, current winrate pill on the right.
  - Controls: two independent checkbox-style toggles for `Win rate` and
    `Score lead`.
  - Chart: blue winrate area/line, gray dashed score-lead line, left percent
    axis, right score axis, current-move marker, and mouse drag navigation.
- Add a derived `scoreLeadData` sequence beside `winrateData`.
  - Persist current engine score lead into the current SGF node when analysis is
    active, using a dedicated private property such as `SBKS`.
  - Use the same current-line node list as `winrateData` so both series align by
    move index.
  - If `scoreLead` is missing for a move, render a gap rather than inventing a
    value.
- Keep `board.analysis_type` for board overlays and menu compatibility. The
  Analysis card toggles control only chart series visibility.

### Left Sidebar

- Restructure the left sidebar into screenshot cards without changing engine
  command behavior:
  - top toolbar: reuse engine attach/start controls with light icon styling;
  - current move row: small capsule row showing the current move number;
  - `ENGINE LOGS`: wraps the existing GTP console log and input;
  - `MOVE LIST`: render the current line as compact move rows with move number,
    stone color, vertex, and a lightweight branch/variation affordance;
  - bottom toolbar: command/settings style buttons matching the screenshot.
- Generate the move list from
  `gameTree.listCurrentNodes(gameCurrents[gameIndex])` and navigate by calling
  `sabaki.setCurrentTreePosition` for the selected row.
- Keep GTP console semantics intact: command history, autocomplete, context
  menu, and selected engine routing must continue to work.

### Workspace Dock and Styling

- Restyle `WorkspaceDock` and `EditBar` to match the screenshot's bottom
  `EDIT WORKSPACE` area: light translucent surface, compact summary line, icon
  buttons, selected tool capsule, and close button.
- Add design tokens in `style/app.css`, but place behavioral/visual selectors in
  `style/index.css` under scoped roots such as `.editWorkspace #leftsidebar`,
  `.editWorkspace #sidebar`, `.editWorkspace .workspace-dock`, and
  `.editWorkspace #winrategraph`.
- Do not add global rules for `.drawer`, `.tab-bar`, `button`,
  `[title]:hover::after`, `.hidden`, `.visible`, `.busy`, `#gamechooser`,
  `#find`, or `#autoplay`.
- Preserve user-resizable widths through existing `SplitContainer` state. Use
  settings/defaults for approximate screenshot proportions instead of hard
  overriding inline grid templates.

## Test and Acceptance Plan

- Run `npm run bundle`.
- Add focused unit or component tests for:
  - `scoreLeadData` derivation from current-line nodes;
  - Analysis card toggle state and path rendering for missing values;
  - move-list row selection navigation.
- Run existing renderer/e2e coverage for edit workspace, sidebars, toolbar
  shortcuts, and analysis/territory flows.
- Capture visual screenshots at the target desktop size and verify:
  - left sidebar width around 368px and right sidebar around 384px;
  - Analysis, Preview, and Game Tree card heights match the screenshot;
  - bottom `EDIT WORKSPACE` dock matches screenshot styling;
  - main board/tatami/stones remain visually unchanged;
  - no drawer, preference, game chooser, or global button styling regresses.

## Assumptions

- The screenshot is the source of truth whenever it conflicts with the text
  guides.
- The first implementation should optimize for edit workspace, because that is
  the screenshot state and where Preview/Workspace Dock are active.
- `SBKS` is acceptable as an internal/private SGF property for persisted score
  lead samples unless a later review chooses a better existing convention.
- If no analysis data exists, the right Analysis card may collapse exactly as
  current `showWinrateGraph` behavior does, but when data exists it should
  render the screenshot-style card.
