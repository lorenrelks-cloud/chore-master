import React, { useEffect, useMemo, useState } from "react";

/**
 * Housemate Chore Balancer — Single-file app
 * - Balanced + randomized weekly assignments
 * - Enforces per-person min/max chores (defaults 8–10, editable)
 * - Quarterly chores = group week (everyone gets the same quarterly chore the same week)
 * - LocalStorage persistence for chores, settings and housemates
 * - Tabs: Dashboard / Edit Chores / Settings
 * - Mail compose with CRLF fix (\r\n)
 */

/* ----------------------------- Types & Utils ------------------------------ */
type FreqKey = "weekly" | "twice_week" | "every_2_weeks" | "monthly" | "quarterly";
type Chore = {
  id: number;
  name: string;
  area?: string;
  weight: number; // 1..5
  freq: FreqKey;
  notes?: string;
};

type Person = { name: string; email?: string };
type WeekAssignment = {
  week: number;
  assignments: { person: string; choreId: number; choreName: string; area?: string; weight: number }[];
  loads: Record<string, number>; // sum of weights
  counts: Record<string, number>; // number of chores
};

const APP_STORAGE_KEY = "chore-master:v2";
const DEFAULT_MIN = 8;
const DEFAULT_MAX = 10;

const CRLF = "\r\n";
function crlfJoin(lines: string[]) {
  return lines.join(CRLF);
}

function uid(seed = 0) {
  // light randomness to break ties
  return Math.sin(Date.now() + seed * 9.73);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* ------------------------------- Defaults --------------------------------- */
const DEFAULT_PEOPLE: Person[] = [
  { name: "Loren", email: "" },
  { name: "Zach", email: "" },
  { name: "Tristyn", email: "" },
];

const DEFAULT_CHORES: Chore[] = [
  // Weekly
  { id: 1, name: "Dusting", area: "Living Room", weight: 3, freq: "weekly" },
  { id: 2, name: "Coffee table", area: "Living Room", weight: 1, freq: "weekly" },
  { id: 3, name: "Side tables", area: "Living Room", weight: 1, freq: "weekly" },
  { id: 4, name: "Wipe counters", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 5, name: "Clean sink", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 6, name: "Organizing fridge", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 7, name: "Wipe washer & dryer", area: "Laundry Room", weight: 2, freq: "weekly" },
  { id: 8, name: "Clean cat food bowls", area: "Laundry Room", weight: 1, freq: "weekly" },
  { id: 9, name: "Sweep stairs", area: "Stairs", weight: 3, freq: "weekly" },

  // Monthly (staggered)
  { id: 10, name: "Clean windows", area: "All Rooms", weight: 5, freq: "monthly" },
  { id: 11, name: "Wipe doors", area: "All Rooms", weight: 3, freq: "monthly" },
  { id: 12, name: "Wipe down trash can", area: "Laundry", weight: 2, freq: "monthly" },
  { id: 13, name: "Deep clean fridge", area: "Kitchen", weight: 4, freq: "monthly" },
  { id: 14, name: "Organizing cabinets", area: "Kitchen", weight: 3, freq: "monthly" },
  { id: 15, name: "Downstairs bathroom", area: "Bathroom", weight: 4, freq: "monthly" },
  { id: 16, name: "Clean dishwasher gasket", area: "Kitchen", weight: 2, freq: "monthly" },
  { id: 17, name: "Clean dishwasher drain", area: "Kitchen", weight: 3, freq: "monthly" },

  // Quarterly (group week)
  { id: 18, name: "Change Filter", area: "Upstairs", weight: 3, freq: "quarterly" },
  { id: 19, name: "Clean baseboards", area: "All Rooms", weight: 4, freq: "quarterly" },
  { id: 20, name: "Wash curtains", area: "Living Room", weight: 4, freq: "quarterly" },
];

/* --------------------------------- App ------------------------------------ */
export default function App() {
  /* ---------- Persistence ---------- */
  const [loaded, setLoaded] = useState(false);
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [chores, setChores] = useState<Chore[]>(DEFAULT_CHORES);

  const [minChores, setMinChores] = useState<number>(DEFAULT_MIN);
  const [maxChores, setMaxChores] = useState<number>(DEFAULT_MAX);
  const [avoidRepeats, setAvoidRepeats] = useState<boolean>(true);
  const [noDupPerWeek, setNoDupPerWeek] = useState<boolean>(true);
  const [cycleWeeks, setCycleWeeks] = useState<number>(4);
  const [cycleStart, setCycleStart] = useState<string>(""); // yyyy-mm-dd
  const [flash, setFlash] = useState<string>("");

  const [tab, setTab] = useState<"dashboard" | "edit" | "settings">("dashboard");

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.people)) setPeople(saved.people);
        if (Array.isArray(saved.chores)) setChores(saved.chores);
        if (typeof saved.minChores === "number") setMinChores(saved.minChores);
        if (typeof saved.maxChores === "number") setMaxChores(saved.maxChores);
        if (typeof saved.avoidRepeats === "boolean") setAvoidRepeats(saved.avoidRepeats);
        if (typeof saved.noDupPerWeek === "boolean") setNoDupPerWeek(saved.noDupPerWeek);
        if (typeof saved.cycleWeeks === "number") setCycleWeeks(saved.cycleWeeks);
        if (typeof saved.cycleStart === "string") setCycleStart(saved.cycleStart);
      }
    } catch { /* noop */ }
    setLoaded(true);
  }, []);

  // save
  useEffect(() => {
    if (!loaded) return;
    const payload = {
      people, chores, minChores, maxChores, avoidRepeats, noDupPerWeek, cycleWeeks, cycleStart,
    };
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
  }, [loaded, people, chores, minChores, maxChores, avoidRepeats, noDupPerWeek, cycleWeeks, cycleStart]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  /* ---------- Frequency helpers ---------- */
  function occurrencesInWeek(chore: Chore, widx: number): number {
    switch (chore.freq) {
      case "weekly": return 1;
      case "twice_week": return 2;
      case "every_2_weeks": return widx % 2 === 0 ? 1 : 0;
      case "monthly": {
        const off = (chore.id - 1) % 4;
        return (widx % 4 === off) ? 1 : 0;
      }
      case "quarterly": {
        // Only the first 4-week block of each quarter (block % 3 === 0), on week 0 of that block
        const block = Math.floor(widx / 4);
        const isQuarterBlock = (block % 3 === 0);
        const isGroupWeek = (widx % 4 === 0);
        return (isQuarterBlock && isGroupWeek) ? 1 : 0;
      }
      default: return 0;
    }
  }

  /* ---------- Assignment core ---------- */
  const weeks: WeekAssignment[] = useMemo(() => {
    if (!people.length || !chores.length) return [];
    const P = people.map(p => p.name);
    const result: WeekAssignment[] = [];

    // Keep memory of last assignee by chore to reduce immediate repeats
    const lastAssignee: Record<number, string | undefined> = {};

    for (let w = 0; w < cycleWeeks; w++) {
      const week: WeekAssignment = {
        week: w + 1,
        assignments: [],
        loads: Object.fromEntries(P.map(p => [p, 0])),
        counts: Object.fromEntries(P.map(p => [p, 0])),
      };

      // Build occurrences list
      type Job = { choreId: number; choreName: string; area?: string; weight: number; isQuarterly: boolean };
      const jobs: Job[] = [];
      const quarterly: Job[] = [];

      for (const c of chores) {
        const times = occurrencesInWeek(c, w);
        for (let i = 0; i < times; i++) {
          const job: Job = { choreId: c.id, choreName: c.name, area: c.area, weight: c.weight, isQuarterly: c.freq === "quarterly" };
          if (job.isQuarterly) quarterly.push(job);
          else jobs.push(job);
        }
      }

      // 1) Assign quarterly: same chore to everyone (group week)
      for (const q of quarterly) {
        for (const person of P) {
          if (noDupPerWeek && week.assignments.some(a => a.person === person && a.choreId === q.choreId)) continue;
          week.assignments.push({ person, choreId: q.choreId, choreName: q.choreName, area: q.area, weight: q.weight });
          week.loads[person] += q.weight;
          week.counts[person] += 1;
          lastAssignee[q.choreId] = person; // not too meaningful here, but update anyway
        }
      }

      // 2) Assign remaining jobs greedily but with randomness, respecting maxChores
      jobs.sort((a, b) => {
        const wdiff = b.weight - a.weight;
        return wdiff !== 0 ? wdiff : (uid(a.choreId) - uid(b.choreId));
      });

      for (const job of jobs) {
        // candidates that haven't hit max and (optionally) didn't do this last time
        let candidates = P.filter(p => week.counts[p] < maxChores);
        if (avoidRepeats && lastAssignee[job.choreId]) {
          candidates = candidates.filter(p => p !== lastAssignee[job.choreId]);
          if (candidates.length === 0) candidates = P.filter(p => week.counts[p] < maxChores);
        }

        // Avoid duplicate of same chore for same person in same week
        candidates = candidates.filter(p => !(noDupPerWeek && week.assignments.some(a => a.person === p && a.choreId === job.choreId)));

        if (candidates.length === 0) continue;

        // pick candidate with fewest counts, then lowest load, then random tiebreak
        candidates.sort((p1, p2) => {
          const c = week.counts[p1] - week.counts[p2];
          if (c !== 0) return c;
          const l = week.loads[p1] - week.loads[p2];
          if (l !== 0) return l;
          return uid(p1.length) - uid(p2.length);
        });

        const chosen = candidates[0];
        week.assignments.push({ person: chosen, choreId: job.choreId, choreName: job.choreName, area: job.area, weight: job.weight });
        week.loads[chosen] += job.weight;
        week.counts[chosen] += 1;
        lastAssignee[job.choreId] = chosen;
      }

      // 3) Min chore enforcement pass: if someone < min and someone else > min, try to reassign a movable low-weight task
      const canMove = (a: { person: string; choreId: number }) => {
        // Don't move quarterly chores (group), keep them fixed
        const ch = chores.find(c => c.id === a.choreId);
        return ch && ch.freq !== "quarterly";
      };

      let changed = true;
      let guard = 0;
      while (changed && guard++ < 100) {
        changed = false;
        const below = P.filter(p => week.counts[p] < minChores);
        const above = P.filter(p => week.counts[p] > minChores).sort((a, b) => week.counts[b] - week.counts[a]);
        if (!below.length || !above.length) break;

        for (const needy of below) {
          for (const donor of above) {
            const movable = week.assignments
              .filter(a => a.person === donor && canMove(a) && (!noDupPerWeek || !week.assignments.some(x => x.person === needy && x.choreId === a.choreId)))
              .sort((a, b) => a.weight - b.weight); // move the lightest first
            if (!movable.length) continue;
            const take = movable[0];
            // reassign
            take.person = needy;
            week.counts[donor] -= 1;
            week.loads[donor] -= take.weight;
            week.counts[needy] += 1;
            week.loads[needy] += take.weight;
            changed = true;
            // break to recompute below/above next loop
            break;
          }
          if (changed) break;
        }
      }

      result.push(week);
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, chores, avoidRepeats, noDupPerWeek, cycleWeeks, minChores, maxChores]);

  /* ---------- UI Helpers ---------- */
  function weekRangeLabel(widx: number) {
    if (!cycleStart) return "";
    const base = new Date(cycleStart + "T00:00:00");
    const monday = new Date(base.getTime() + widx * 7 * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    return `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
  }
  function getCurrentWeekIndex() {
    if (!cycleStart) return 0;
    const start = new Date(cycleStart + "T00:00:00");
    const now = new Date();
    const ms = now.getTime() - start.getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 0) return 0;
    const w = Math.floor(days / 7);
    return ((w % cycleWeeks) + cycleWeeks) % cycleWeeks;
  }

  function groupedListFor(personName: string, widx: number) {
    const week = weeks[widx] || weeks[0];
    const mine = week.assignments.filter(a => a.person === personName);
    const g = mine.reduce<Record<string, { name: string; area?: string; weight: number; count: number }>>((acc, a) => {
      const key = `${a.choreId}|${a.area ?? ""}`;
      if (!acc[key]) acc[key] = { name: a.choreName, area: a.area, weight: a.weight, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {});
    const items = Object.values(g).sort((a, b) => b.weight - a.weight || (a.name.localeCompare(b.name)));
    const totalLoad = items.reduce((s, it) => s + it.weight * it.count, 0);
    return { items, totalLoad };
  }

  function buildEmailBody(personName: string, widx: number) {
    const { items, totalLoad } = groupedListFor(personName, widx);
    const lines: string[] = [];
    lines.push(`Hi ${personName},`, "", `Here are your chores for this week (Week ${weeks[widx]?.week || (widx + 1)}${cycleStart ? `, ${weekRangeLabel(widx)}` : ""}).`, "");
    if (items.length === 0) lines.push("- none -");
    else {
      for (const it of items) {
        const area = it.area ? ` [${it.area}]` : "";
        const count = it.count > 1 ? ` x${it.count}` : "";
        lines.push(`- ${it.name}${area}${count} (w${it.weight})`);
      }
    }
    lines.push("", `Total weekly load: ${totalLoad}`, "", "Have a great week!");
    return crlfJoin(lines);
  }

  function composeEmailsForCurrentWeek() {
    const widx = getCurrentWeekIndex();
    const missing: string[] = [];
    people.forEach(p => {
      if (!p.email) { missing.push(p.name); return; }
      const subject = `This Week's Chores — Week ${weeks[widx]?.week || (widx + 1)}${cycleStart ? ` (${weekRangeLabel(widx)})` : ""}`;
      const body = buildEmailBody(p.name, widx);
      const url = `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank");
    });
    if (missing.length) setFlash(`No email on file for: ${missing.join(", ")}`);
    else setFlash("Opened email drafts for all housemates");
  }

  const totalsOverCycle = useMemo(() => {
    const totals = Object.fromEntries(people.map(p => [p.name, 0]));
    weeks.forEach(week => {
      people.forEach(p => totals[p.name] += week.loads[p.name] || 0);
    });
    return totals;
  }, [weeks, people]);

  /* ------------------------------ Renderers -------------------------------- */
  function Dashboard() {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">Housemate Chore Balancer</div>
          <div className="flex gap-2">
            <button
              onClick={composeEmailsForCurrentWeek}
              className="px-3 py-1.5 rounded-lg border bg-blue-50 hover:bg-blue-100"
            >
              Compose this week&apos;s emails
            </button>
          </div>
        </div>

        {weeks.map((week, widx) => (
          <div key={week.week} className="rounded-xl border p-3">
            <div className="font-semibold mb-2">
              Week {week.week}{cycleStart ? ` — ${weekRangeLabel(widx)}` : ""}
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {people.map(p => {
                const { items, totalLoad } = groupedListFor(p.name, widx);
                return (
                  <div key={p.name} className="rounded-lg border p-3">
                    <div className="font-medium mb-1">
                      {p.name} <span className="text-xs text-slate-500">load {totalLoad}</span>
                    </div>
                    <ul className="text-sm list-disc pl-4">
                      {items.length === 0 ? (
                        <li className="text-slate-400 italic">—</li>
                      ) : items.map((it, i) => (
                        <li key={i}>
                          {it.name}{it.count > 1 ? ` x${it.count}` : ""}{it.area ? ` [${it.area}]` : ""} (w{it.weight})
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-xl border p-3">
          <div className="font-semibold mb-2">Total Load (whole cycle)</div>
          <ul className="space-y-1">
            {people.map(p => (
              <li key={p.name} className="flex items-center justify-between">
                <span>{p.name}</span>
                <span className="font-semibold">{totalsOverCycle[p.name] || 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function EditChores() {
    const [newChore, setNewChore] = useState<Chore>({
      id: Math.max(0, ...chores.map(c => c.id)) + 1,
      name: "",
      area: "",
      weight: 2,
      freq: "weekly",
      notes: "",
    });

    function addChore() {
      if (!newChore.name.trim()) return;
      const id = Math.max(0, ...chores.map(c => c.id)) + 1;
      setChores(prev => [...prev, { ...newChore, id, weight: clamp(Number(newChore.weight) || 1, 1, 5) }]);
      setNewChore({ id: id + 1, name: "", area: "", weight: 2, freq: "weekly", notes: "" });
      setFlash("Chore added");
    }
    function removeChore(id: number) {
      setChores(prev => prev.filter(c => c.id !== id));
    }
    function resetDefaults() {
      setChores(DEFAULT_CHORES);
      setFlash("Chores reset to defaults");
    }

    const FREQS: { key: FreqKey; label: string }[] = [
      { key: "weekly", label: "Weekly" },
      { key: "twice_week", label: "Twice a Week" },
      { key: "every_2_weeks", label: "Every 2 Weeks" },
      { key: "monthly", label: "Monthly (staggered)" },
      { key: "quarterly", label: "Quarterly (group week)" },
    ];

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">Edit Chores</div>
          <button onClick={resetDefaults} className="px-3 py-1.5 rounded-lg border bg-amber-50 hover:bg-amber-100">
            Reset to Defaults
          </button>
        </div>

        <div className="rounded-xl border p-3 space-y-3">
          <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-600">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-1">Weight</div>
            <div className="col-span-3">Frequency</div>
            <div className="col-span-2">Notes</div>
            <div className="col-span-1 text-right"> </div>
          </div>

          {chores.map(c => (
            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
              <input className="col-span-3 rounded border px-2 py-1" value={c.name}
                     onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
              <input className="col-span-2 rounded border px-2 py-1" value={c.area || ""}
                     onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, area: e.target.value } : x))} />
              <input type="number" min={1} max={5} className="col-span-1 rounded border px-2 py-1 text-center" value={c.weight}
                     onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, weight: clamp(Number(e.target.value)||1,1,5) } : x))} />
              <select className="col-span-3 rounded border px-2 py-1" value={c.freq}
                      onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, freq: e.target.value as FreqKey } : x))}>
                {FREQS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <input className="col-span-2 rounded border px-2 py-1" value={c.notes || ""}
                     onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, notes: e.target.value } : x))} />
              <div className="col-span-1 text-right">
                <button onClick={() => removeChore(c.id)} className="text-red-600 hover:underline">Remove</button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-12 gap-2 items-center border-t pt-3">
            <input className="col-span-3 rounded border px-2 py-1" placeholder="New chore name" value={newChore.name}
                   onChange={e => setNewChore(s => ({ ...s, name: e.target.value }))} />
            <input className="col-span-2 rounded border px-2 py-1" placeholder="Location" value={newChore.area}
                   onChange={e => setNewChore(s => ({ ...s, area: e.target.value }))} />
            <input type="number" min={1} max={5} className="col-span-1 rounded border px-2 py-1 text-center" value={newChore.weight}
                   onChange={e => setNewChore(s => ({ ...s, weight: clamp(Number(e.target.value)||2,1,5) }))} />
            <select className="col-span-3 rounded border px-2 py-1" value={newChore.freq}
                    onChange={e => setNewChore(s => ({ ...s, freq: e.target.value as FreqKey }))}>
              {FREQS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <input className="col-span-2 rounded border px-2 py-1" placeholder="Notes (optional)" value={newChore.notes}
                   onChange={e => setNewChore(s => ({ ...s, notes: e.target.value }))} />
            <div className="col-span-1 text-right">
              <button onClick={addChore} className="px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100">Add</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Settings() {
    const [peopleText, setPeopleText] = useState(
      people.map(p => p.email ? `${p.name} <${p.email}>` : p.name).join(", ")
    );
    function savePeople() {
      const parsed = peopleText.split(",").map(s => s.trim()).filter(Boolean).map(s => {
        const m = s.match(/^(.+?)(?:<([^>]+)>)?$/);
        return { name: (m ? m[1] : s).trim(), email: (m && m[2] ? m[2].trim() : "") };
      });
      if (parsed.length) setPeople(parsed);
      setFlash("Housemates saved");
    }
    function clearAll() {
      localStorage.removeItem(APP_STORAGE_KEY);
      setPeople(DEFAULT_PEOPLE);
      setChores(DEFAULT_CHORES);
      setMinChores(DEFAULT_MIN);
      setMaxChores(DEFAULT_MAX);
      setAvoidRepeats(true);
      setNoDupPerWeek(true);
      setCycleWeeks(4);
      setCycleStart("");
      setFlash("Saved data cleared");
    }
    return (
      <div className="p-4 space-y-4">
        <div className="text-2xl font-semibold">Settings</div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="font-medium">Housemates</div>
          <div className="text-sm text-slate-600">Comma-separated. Optional emails in angle brackets, e.g., Loren &lt;loren@example.com&gt;.</div>
          <input className="w-full rounded border px-3 py-2" value={peopleText} onChange={e => setPeopleText(e.target.value)} />
          <button onClick={savePeople} className="px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100">Save</button>
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="font-medium">Cycle</div>
          <label className="flex items-center gap-3">
            <span className="w-56">Cycle start (Monday)</span>
            <input type="date" className="rounded border px-2 py-1" value={cycleStart} onChange={e => setCycleStart(e.target.value)} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-56">Cycle length (weeks)</span>
            <input type="number" min={1} max={12} className="rounded border px-2 py-1 w-24 text-right"
                   value={cycleWeeks} onChange={e => setCycleWeeks(clamp(Number(e.target.value)||4,1,12))} />
          </label>
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="font-medium">Assignment rules</div>
          <label className="flex items-center gap-3">
            <span className="w-56">Min chores / person / week</span>
            <input type="number" min={1} max={20} className="rounded border px-2 py-1 w-24 text-right"
                   value={minChores} onChange={e => setMinChores(clamp(Number(e.target.value)||DEFAULT_MIN,1,20))} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-56">Max chores / person / week</span>
            <input type="number" min={1} max={20} className="rounded border px-2 py-1 w-24 text-right"
                   value={maxChores} onChange={e => setMaxChores(clamp(Number(e.target.value)||DEFAULT_MAX,1,20))} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-56">Avoid repeats week-to-week</span>
            <input type="checkbox" checked={avoidRepeats} onChange={e => setAvoidRepeats(e.target.checked)} />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-56">No same chore twice in a week</span>
            <input type="checkbox" checked={noDupPerWeek} onChange={e => setNoDupPerWeek(e.target.checked)} />
          </label>
        </div>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="font-medium">Danger zone</div>
          <button onClick={clearAll} className="px-3 py-1.5 rounded-lg border bg-red-50 hover:bg-red-100 text-red-700">
            Clear saved data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tabs */}
      <div className="px-4 pt-4 flex items-center gap-4">
        <button onClick={() => setTab("dashboard")}
                className={`pb-2 ${tab === "dashboard" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600"}`}>
          Dashboard
        </button>
        <button onClick={() => setTab("edit")}
                className={`pb-2 ${tab === "edit" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600"}`}>
          Edit Chores
        </button>
        <button onClick={() => setTab("settings")}
                className={`pb-2 ${tab === "settings" ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-600"}`}>
          Settings
        </button>
        <div className="ml-auto text-sm text-slate-500">{flash}</div>
      </div>

      {tab === "dashboard" ? <Dashboard /> : tab === "edit" ? <EditChores /> : <Settings />}
      <div className="text-center text-xs text-slate-500 pb-6">Built for household harmony. Bribes in cookie form accepted.</div>
    </div>
  );
}
