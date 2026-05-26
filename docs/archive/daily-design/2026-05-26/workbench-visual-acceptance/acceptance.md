# Workbench Visual Acceptance - 2026-05-26

Source truth: `docs/ui_ux/workbench-ref-pics/2026-05-26-six-screen/`

Capture target: production Workbench components rendered through `docs/.visual-acceptance/workbench-harness/`.

## Verdict

| Scenario | Screenshot | Result | Notes |
| --- | --- | --- | --- |
| Problem | `screenshots/problem.png` | Pass | No visible `wb-global-header`; board, left prompt, right monitor cards, and bottom actions render without overlap. |
| Recall | `screenshots/recall.png` | Pass | Recall progress, status, error record, success feedback, and bottom actions are visible and stable. |
| Play - History | `screenshots/play-history.png` | Pass | Library drawer opens on `历史记录`; previous `棋谱库` content is now treated as history. |
| Play - Kifu Library | `screenshots/play-kifu.png` | Pass | `棋谱库` is now a separate imported/local SGF list. |
| Play - Game Records | `screenshots/play-games.png` | Pass | `对局库` is now a separate opened/saved game record list. |
| Analysis | `screenshots/analysis.png` | Pass | Variation tree, bad move list, reference board, AI table, note card, and bottom actions fit without clipping. |
| Analysis - Library Drawer | `screenshots/analysis-library.png` | Pass | Drawer state keeps the same three-tab information architecture over the Analysis page. |
| Recall Checkpoint | `screenshots/checkpoint.png` | Pass | Problem hand, correction draft, revealed AI comparison, comment area, and checkpoint actions fit in one viewport. |

## Automated Checks

- `shell`, `modeBar`, and `board` were present in every scenario.
- `drawer` was present for all library drawer scenarios.
- `hasGlobalHeaderClass` was `false` in every scenario.
- `overflowCount` was `0` in every scenario after final adjustment.

Raw metrics: `screenshots/acceptance-results.json`
