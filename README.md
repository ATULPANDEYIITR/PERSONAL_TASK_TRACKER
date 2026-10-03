# Task Tracker

A dynamic, offline-first tracker for platforms, publications, courses, exams, competitions,
companies and everyday tasks. Categories and fields are data - add or delete them any time.

**Stack:** React + TypeScript + Vite, IndexedDB (Dexie), Python migration script.

## Setup (VS Code terminal)

```bash
npm install
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r scripts/requirements.txt

# Convert your Excel file (re-runnable; IDs are stable)
python scripts/migrate_excel.py path/to/MASTER_FILE_CATEGORIZED_15_HEADS.xlsx

npm run dev        # open the URL, click "Choose file", pick data/private/seed.json
python -m pytest -q
```

## No-duplicate rule
Tasks are compared on a normalised key (case, spacing, punctuation ignored). The migration keeps the
first occurrence and records every original row in `sourceRefs`. The database has a UNIQUE index on
`dedupeKey`, so a duplicate task cannot be inserted later either.

## Privacy
`data/private/` and `*.xlsx` are git-ignored. Keep it that way: the data includes personal emails and
company identifiers (PAN, GST, bank). If you publish the repo, publish only the code.

## Roadmap
1. Scaffold + schema (done)  2. Excel -> clean JSON (done)  3. Category and item CRUD
4. Dynamic fields and category management  5. Dashboard, calendar, deadlines
6. Recurring tasks, reminders, stale-profile tracker  7. Backup, deploy, polish
