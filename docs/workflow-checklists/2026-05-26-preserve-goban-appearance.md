# Workflow Checklist

- workflow: frontend-visual-workflow
- task: Preserve the original Sabaki Goban appearance inside Workbench while keeping fallback-only visual scaffolding separate.
- created: 2026-05-26
- source_truth: src/components/Goban.js, node_modules/@sabaki/shudan/css/goban.css, style/index.css

## Steps

- [x] step1: Identify Workbench CSS selectors that override real `#goban` appearance — role: frontend-design-source-reader — mode: serial
- [x] step2: Split real Goban layout from fallback-only board styling — role: frontend-implementation-agent — mode: serial
- [x] step3: Run focused import/bundle verification — role: verification — mode: serial

## Retries

(none)
