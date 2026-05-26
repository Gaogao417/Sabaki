# Workflow Checklist

- workflow: frontend-visual-workflow
- task: Remove the visible Workbench global header row and split the library drawer into History, Kifu Library, and Game Library tabs.
- created: 2026-05-26
- source_truth: user feedback on Workbench six-screen frontend

## Steps

- [x] step1: Remove `wb-global-header` from the visible Workbench layout while preserving shell compatibility anchors — role: frontend-implementation-agent — mode: serial
- [x] step2: Rework `LibrarySideDrawer` into three material tabs: 历史记录, 棋谱库, 对局库, with current recent-project content moved under 历史记录 — role: frontend-implementation-agent — mode: serial
- [x] step3: Run focused shell/drawer tests and bundle/import verification — role: verification — mode: serial

## Retries

(none)
