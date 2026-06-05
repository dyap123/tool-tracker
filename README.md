# HoundTool — Tool Tracker

Standalone static tool-tracking app for the LACC project crew. Migrated off the const-agent
Python/Sheets stack onto the traditional Firebase + GitHub Pages stack (like cup-dashboard,
foreman-attendance, concrete-breaks). No server to keep alive.

**Live:** https://dyap123.github.io/tool-tracker/

## What it does
- **Inventory** — assets built from ToolHound reports + manually-added on-site tools. Tracks the monthly rental charge (sum of on-site unit cost).
- **Import ToolHound** — upload CSV/Excel (preferred) or PDF; auto-detects Issues / Transaction / Rental-charge formats; review-before-commit diff (add / update / mark returned).
- **Add Tool On-Site** — manual add for extra tools not on a ToolHound report (tool type, tool #, cost).
- **Orders** — create orders + a receiving checklist (Pending → Arrived → add to inventory).
- **On-Site Audit** — walk the site, check off what's present, Mark Missing, Generate Summary PDF.
- **Lost Tracker** — append-only Lost Log with all-time count + value; dated Lost Report PDF; **Count & Compare** reconcile (enter 11×17 counts → short categories highlight → drill to Item IDs → Mark Lost).
- **Foreman Reports** — bilingual EN/ES **11×17 blank count checklist** (print → Save as PDF) and a **filled summary report** with signature lines.
- **Exports** — PDF (jsPDF) + Excel (SheetJS), with the iOS share sheet.

## Stack
- Single `index.html`, no build step. Tailwind (CDN) + Inter + Material Symbols (Stitch "Hardline Industrial" design).
- Firebase Realtime Database (compat SDK 10.12.0), shared project `gen-lang-client-0119642855`, namespaced under `tool-tracker/`.
- Manager actions gated by a PIN (default `050103`, stored at `tool-tracker/config/pin`).

## Run locally
```
python3 -m http.server 8899
# open http://localhost:8899/index.html
```
Use `tool-tracker-dev` as the namespace while testing: edit `const NS` near the top of the script. Serve over http (not file://) so pdf.js + navigator.share work.

## Data
See `BACKEND.md` for the full Firebase schema and the UI data-action/ID contract.
