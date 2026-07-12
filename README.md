# Work Tracker

Simple time in / time out tracker for simulating a work environment. Data is stored in a JSON file (`server/data/timelog.json`) and can be exported as CSV (opens directly in Google Sheets or Excel).

## Setup

```
npm run install:all
```

## Run

```
npm run dev
```

This starts:
- API server at http://localhost:4000 (reads/writes `server/data/timelog.json`)
- Web app at http://localhost:5173

Open http://localhost:5173 in your browser.

## Usage

- **Time In** — starts a new session (optionally with a note).
- **Time Out** — closes the current open session and records hours worked.
- **History table** — shows all past sessions; click **Edit** to manually correct a time entry (useful when simulating hours), or **Delete** to remove one.
- **Export CSV** — downloads `time-log-<timestamp>.csv` with all entries and a total-hours row. Open it in Google Sheets via File > Import, or just drag it into Sheets.

## Data

All entries live in `server/data/timelog.json`, a plain array:

```json
[
  {
    "id": "...",
    "date": "2026-07-12",
    "timeIn": "2026-07-12T09:00:00.000Z",
    "timeOut": "2026-07-12T17:00:00.000Z",
    "hours": 8,
    "note": "..."
  }
]
```
