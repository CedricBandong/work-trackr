import { useEffect, useState, useCallback } from "react";

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [openEntry, setOpenEntry] = useState(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ timeIn: "", timeOut: "", note: "" });
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [entriesRes, statusRes] = await Promise.all([
      fetch("/api/entries").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
    ]);
    setEntries(entriesRes);
    setOpenEntry(statusRes.open);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!openEntry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  const handleTimeIn = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/time-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to time in");
      setNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeOut = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/time-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to time out");
      setNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditDraft({
      timeIn: toLocalInputValue(entry.timeIn),
      timeOut: toLocalInputValue(entry.timeOut),
      note: entry.note || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    const res = await fetch(`/api/entries/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeIn: fromLocalInputValue(editDraft.timeIn),
        timeOut: fromLocalInputValue(editDraft.timeOut),
        note: editDraft.note,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      await load();
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Work Tracker</h1>
        <a className="export-btn" href="/api/export" download>
          Export CSV
        </a>
      </header>

      <section className="status-card">
        {openEntry ? (
          <>
            <div className="status-pill status-in">Clocked In</div>
            <div className="elapsed">{formatElapsed(now - new Date(openEntry.timeIn))}</div>
            <div className="since">since {formatTime(openEntry.timeIn)}</div>
          </>
        ) : (
          <>
            <div className="status-pill status-out">Not Clocked In</div>
            <div className="since">Ready to start a session</div>
          </>
        )}

        <input
          className="note-input"
          type="text"
          placeholder="Optional note (task, project...)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {openEntry ? (
          <button className="btn btn-out" onClick={handleTimeOut} disabled={loading}>
            Time Out
          </button>
        ) : (
          <button className="btn btn-in" onClick={handleTimeIn} disabled={loading}>
            Time In
          </button>
        )}

        {error && <div className="error">{error}</div>}
      </section>

      <section className="table-section">
        <div className="table-header">
          <h2>History</h2>
          <div className="total">Total: {Math.round(totalHours * 100) / 100} h</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Hours</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                {editingId === e.id ? (
                  <>
                    <td>{e.date}</td>
                    <td>
                      <input
                        type="datetime-local"
                        value={editDraft.timeIn}
                        onChange={(ev) =>
                          setEditDraft((d) => ({ ...d, timeIn: ev.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        value={editDraft.timeOut}
                        onChange={(ev) =>
                          setEditDraft((d) => ({ ...d, timeOut: ev.target.value }))
                        }
                      />
                    </td>
                    <td>—</td>
                    <td>
                      <input
                        type="text"
                        value={editDraft.note}
                        onChange={(ev) =>
                          setEditDraft((d) => ({ ...d, note: ev.target.value }))
                        }
                      />
                    </td>
                    <td className="actions">
                      <button className="link-btn" onClick={() => saveEdit(e.id)}>
                        Save
                      </button>
                      <button className="link-btn" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{e.date}</td>
                    <td>{formatTime(e.timeIn)}</td>
                    <td>{formatTime(e.timeOut)}</td>
                    <td>{e.hours ?? "—"}</td>
                    <td className="note-cell">{e.note}</td>
                    <td className="actions">
                      <button className="link-btn" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <button className="link-btn danger" onClick={() => deleteEntry(e.id)}>
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No entries yet. Clock in to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
