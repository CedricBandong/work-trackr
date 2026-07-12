const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "data", "timelog.json");
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

async function readEntries() {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw || "[]");
}

async function writeEntries(entries) {
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

function computeHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  const ms = new Date(timeOut) - new Date(timeIn);
  return Math.round((ms / 3600000) * 100) / 100;
}

// All entries, newest first
app.get("/api/entries", async (req, res) => {
  const entries = await readEntries();
  entries.sort((a, b) => new Date(b.timeIn) - new Date(a.timeIn));
  res.json(entries);
});

// Currently open entry (clocked in, not yet out), if any
app.get("/api/status", async (req, res) => {
  const entries = await readEntries();
  const open = entries.find((e) => !e.timeOut) || null;
  res.json({ open });
});

// Clock in
app.post("/api/time-in", async (req, res) => {
  const entries = await readEntries();
  const alreadyOpen = entries.find((e) => !e.timeOut);
  if (alreadyOpen) {
    return res.status(400).json({ error: "Already clocked in", entry: alreadyOpen });
  }
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    date: now.slice(0, 10),
    timeIn: now,
    timeOut: null,
    hours: null,
    note: (req.body && req.body.note) || "",
  };
  entries.push(entry);
  await writeEntries(entries);
  res.status(201).json(entry);
});

// Clock out
app.post("/api/time-out", async (req, res) => {
  const entries = await readEntries();
  const open = entries.find((e) => !e.timeOut);
  if (!open) {
    return res.status(400).json({ error: "Not currently clocked in" });
  }
  const now = new Date().toISOString();
  open.timeOut = now;
  open.hours = computeHours(open.timeIn, now);
  if (req.body && req.body.note) {
    open.note = req.body.note;
  }
  await writeEntries(entries);
  res.json(open);
});

// Manual edit (for correcting simulated hours)
app.put("/api/entries/:id", async (req, res) => {
  const entries = await readEntries();
  const entry = entries.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const { timeIn, timeOut, note } = req.body || {};
  if (timeIn) entry.timeIn = timeIn;
  if (timeOut !== undefined) entry.timeOut = timeOut;
  if (note !== undefined) entry.note = note;
  entry.date = entry.timeIn.slice(0, 10);
  entry.hours = computeHours(entry.timeIn, entry.timeOut);

  await writeEntries(entries);
  res.json(entry);
});

// Delete an entry
app.delete("/api/entries/:id", async (req, res) => {
  const entries = await readEntries();
  const next = entries.filter((e) => e.id !== req.params.id);
  if (next.length === entries.length) {
    return res.status(404).json({ error: "Entry not found" });
  }
  await writeEntries(next);
  res.status(204).end();
});

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// CSV export (opens in Google Sheets / Excel via Import or Open)
app.get("/api/export", async (req, res) => {
  const entries = await readEntries();
  entries.sort((a, b) => new Date(a.timeIn) - new Date(b.timeIn));

  const header = ["Date", "Time In", "Time Out", "Hours", "Note"];
  const rows = entries.map((e) => [
    e.date,
    e.timeIn ? new Date(e.timeIn).toLocaleTimeString() : "",
    e.timeOut ? new Date(e.timeOut).toLocaleTimeString() : "",
    e.hours ?? "",
    e.note ?? "",
  ]);
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
  rows.push([]);
  rows.push(["", "", "Total", Math.round(totalHours * 100) / 100, ""]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="time-log-${Date.now()}.csv"`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`Work tracker server running at http://localhost:${PORT}`);
});
