# Backend & Data Contract

## Firebase RTDB — namespace `tool-tracker/`
Shared project `gen-lang-client-0119642855` (`https://gen-lang-client-0119642855-default-rtdb.firebaseio.com`). Rules are open (same as the sibling apps). Switch `const NS` to `tool-tracker-dev` for testing.

```
config/        pin, projectName, contractor, lastImportAt, lastImportFile
assets/{itemKey}/   item_id, serial, part_no, description, category, unit_cost (MONTHLY),
               po, issued_date, assigned_to, status (On Site|Transferred|Returned|Lost|Damaged),
               notes, qty, verified (Yes|Missing|""), verifiedAt, source (issues|transaction|rental|manual|pdf),
               createdAt, updatedAt
orders/{pushKey}/   order_date, date_needed, qty, unit, description, employee, primary_id, po,
               status (Pending|Delivered|Cancelled), notes, createdAt, updatedAt
lostLog/{pushKey}/  date, item_id, serial, description, category, unit_cost, markedBy, at   (append-only)
counters/lostAllTime   <int>   (atomic via fb.inc; authoritative source is lostLog)
foremen/{pushKey}/  name, active, order
imports/{pushKey}/  file, type, addedCount, updatedCount, removedCount, at
```

**Asset key** = `sanitize(item_id)` or, if no item_id, `pn_<part_no>_<hash(description)>`. Deterministic so re-imports update instead of duplicating. Raw `item_id` is always stored as a field.

**Derived on read (never stored):** monthly charge = Σ `unit_cost*qty` where status `On Site`; on-site count; lost report day total.

## Firebase bridge (`window.fb`)
`listen, set, update, remove, push, get, inc, max, rootGet, rootSet` — namespaced helpers (copied from concrete-breaks). Live listeners populate the in-memory `state`; all renders read from `state`.

## UI contract (for re-skinning / Stitch updates)
- **Views** render into `#viewRoot` via `renderDashboard/Assets/Orders/Audits/Reports/Lost`. Nav uses `data-view="<id>"`; hash routing (`#assets`, …) is supported.
- **Actions** use `data-action="<name>"` (+ `data-key`, `data-st`, etc.) routed by one delegated click listener → `dispatchAction` → `dispatchAction4` / `dispatchAction5`. All actions are also reachable as functions.
- **Classification** (`classifyAssets`, `groupForReconcile`) is a faithful JS port of const-agent `tools/tool_report.py` and is verified to match it exactly (category rules, brand/subtype, consumable exclusions, "needs ID" flagging). It drives the 11×17 checklist, the reconcile grid, and dashboard category stats.

## ToolHound import
`detectReportType` → header signatures (`qty outstanding`→issues, `transaction type`+`return status`→transaction, `part no`/`monthly`→rental). CSV/XLSX via SheetJS; PDF via pdf.js text extraction (best-effort, always manual-reviewed). `normalize` → unified asset shape → `diffImport` (added/updated/removed) → review modal → `commitImport`.

## Reports
- 11×17 checklist + filled summary: HTML `@media print` → browser Save-as-PDF (`printChecklist`, `printSummary`).
- Lost report + on-site summary: jsPDF + autotable (`buildLostReportPdf`, `buildOnSiteSummaryPdf`).
- Excel: SheetJS (`exportAssetsXlsx`, `exportLostXlsx`).
