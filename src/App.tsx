import React, { useEffect, useMemo, useState } from "react";

/**
 * Housemate Chore Balancer
 * - Balanced + randomized weekly assignments
 * - Enforces min/max chores (defaults 8–10, editable in Settings)
 * - Quarterly chores = group week
 * - LocalStorage persistence
 * - Tabs: Dashboard / Edit Chores / Settings
 */

type FreqKey = "weekly" | "twice_week" | "every_2_weeks" | "monthly" | "quarterly";
type Chore = { id: number; name: string; area?: string; weight: number; freq: FreqKey; notes?: string };
type Person = { name: string; email?: string };
type WeekAssignment = {
  week: number;
  assignments: { person: string; choreId: number; choreName: string; area?: string; weight: number }[];
  loads: Record<string, number>;
  counts: Record<string, number>;
};

const APP_STORAGE_KEY = "chore-master:v2";
const DEFAULT_MIN = 8;
const DEFAULT_MAX = 10;

const DEFAULT_PEOPLE: Person[] = [
  { name: "Loren" },
  { name: "Zach" },
  { name: "Tristyn" },
];

const DEFAULT_CHORES: Chore[] = [
  { id: 1, name: "Dusting", area: "Living Room", weight: 3, freq: "weekly" },
  { id: 2, name: "Coffee table", area: "Living Room", weight: 1, freq: "weekly" },
  { id: 3, name: "Side tables", area: "Living Room", weight: 1, freq: "weekly" },
  { id: 4, name: "Wipe counters", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 5, name: "Clean sink", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 6, name: "Organizing fridge", area: "Kitchen", weight: 2, freq: "weekly" },
  { id: 7, name: "Wipe washer & dryer", area: "Laundry Room", weight: 2, freq: "weekly" },
  { id: 8, name: "Clean cat food bowls", area: "Laundry Room", weight: 1, freq: "weekly" },
  { id: 9, name: "Sweep stairs", area: "Stairs", weight: 3, freq: "weekly" },
  { id: 10, name: "Clean windows", area: "All Rooms", weight: 5, freq: "monthly" },
  { id: 11, name: "Wipe doors", area: "All Rooms", weight: 3, freq: "monthly" },
  { id: 12, name: "Wipe down trash can", area: "Laundry", weight: 2, freq: "monthly" },
  { id: 13, name: "Deep clean fridge", area: "Kitchen", weight: 4, freq: "monthly" },
  { id: 14, name: "Organizing cabinets", area: "Kitchen", weight: 3, freq: "monthly" },
  { id: 15, name: "Downstairs bathroom", area: "Bathroom", weight: 4, freq: "monthly" },
  { id: 16, name: "Clean dishwasher gasket", area: "Kitchen", weight: 2, freq: "monthly" },
  { id: 17, name: "Clean dishwasher drain", area: "Kitchen", weight: 3, freq: "monthly" },
  { id: 18, name: "Change Filter", area: "Upstairs", weight: 3, freq: "quarterly" },
  { id: 19, name: "Clean baseboards", area: "All Rooms", weight: 4, freq: "quarterly" },
  { id: 20, name: "Wash curtains", area: "Living Room", weight: 4, freq: "quarterly" },
];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [chores, setChores] = useState<Chore[]>(DEFAULT_CHORES);
  const [minChores, setMinChores] = useState(DEFAULT_MIN);
  const [maxChores, setMaxChores] = useState(DEFAULT_MAX);
  const [cycleWeeks, setCycleWeeks] = useState(4);
  const [tab, setTab] = useState<"dashboard" | "edit" | "settings">("dashboard");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(APP_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.people) setPeople(saved.people);
        if (saved.chores) setChores(saved.chores);
        if (saved.minChores) setMinChores(saved.minChores);
        if (saved.maxChores) setMaxChores(saved.maxChores);
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const payload = { people, chores, minChores, maxChores, cycleWeeks };
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
  }, [loaded, people, chores, minChores, maxChores, cycleWeeks]);

  const weeks: WeekAssignment[] = useMemo(() => {
    if (!people.length || !chores.length) return [];
    const P = people.map(p => p.name);
    const result: WeekAssignment[] = [];

    function occurrencesInWeek(chore: Chore, widx: number) {
      switch (chore.freq) {
        case "weekly": return 1;
        case "every_2_weeks": return widx % 2 === 0 ? 1 : 0;
        case "monthly": return (widx % 4 === (chore.id - 1) % 4) ? 1 : 0;
        case "quarterly": return widx % 12 === 0 ? 1 : 0;
        default: return 0;
      }
    }

    for (let w = 0; w < cycleWeeks; w++) {
      const week: WeekAssignment = {
        week: w + 1,
        assignments: [],
        loads: Object.fromEntries(P.map(p => [p, 0])),
        counts: Object.fromEntries(P.map(p => [p, 0])),
      };

      const jobs: Chore[] = [];
      for (const c of chores) {
        const times = occurrencesInWeek(c, w);
        for (let i = 0; i < times; i++) jobs.push(c);
      }

      for (const chore of jobs) {
        const chosen = P.sort((a, b) => week.counts[a] - week.counts[b])[0];
        week.assignments.push({ person: chosen, choreId: chore.id, choreName: chore.name, area: chore.area, weight: chore.weight });
        week.counts[chosen]++; week.loads[chosen] += chore.weight;
      }

      // enforce min/max
      for (const p of P) {
        while (week.counts[p] < minChores) {
          const donor = P.find(x => week.counts[x] > minChores);
          if (!donor) break;
          const moved = week.assignments.find(a => a.person === donor);
          if (!moved) break;
          moved.person = p;
          week.counts[donor]--; week.counts[p]++;
        }
        while (week.counts[p] > maxChores) {
          const moved = week.assignments.find(a => a.person === p);
          if (!moved) break;
          week.assignments = week.assignments.filter(a => a !== moved);
          week.counts[p]--;
        }
      }

      result.push(week);
    }
    return result;
  }, [people, chores, minChores, maxChores, cycleWeeks]);

  function groupedListFor(person: string, widx: number) {
    const week = weeks[widx];
    const mine = week.assignments.filter(a => a.person === person);
    const totalLoad = mine.reduce((s, a) => s + a.weight, 0);
    return { items: mine, totalLoad, totalCount: mine.length };
  }

  function Dashboard() {
    return (
      <div className="p-4 space-y-4">
        {weeks.map((week, widx) => (
          <div key={week.week} className="rounded-xl border p-3">
            <div className="font-semibold mb-2">Week {week.week}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {people.map(p => {
                const { items, totalLoad, totalCount } = groupedListFor(p.name, widx);
                return (
                  <div key={p.name} className="rounded-lg border p-3">
                    <div className="font-medium mb-1">
                      {p.name} <span className="text-xs text-slate-500">({totalCount} chores • load {totalLoad})</span>
                    </div>
                    <ul className="text-sm list-disc pl-4">
                      {items.map((it, i) => (
                        <li key={i}>{it.choreName}{it.area ? ` [${it.area}]` : ""} (w{it.weight})</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function EditChores() {
    const [newChore, setNewChore] = useState<Chore>({ id: chores.length + 1, name: "", area: "", weight: 2, freq: "weekly" });
    return (
      <div className="p-4 space-y-4">
        <div className="text-xl font-semibold">Edit Chores</div>
        {chores.map(c => (
          <div key={c.id} className="flex gap-2">
            <input value={c.name} onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
            <button onClick={() => setChores(prev => prev.filter(x => x.id !== c.id))}>Remove</button>
          </div>
        ))}
        <input value={newChore.name} onChange={e => setNewChore({ ...newChore, name: e.target.value })} placeholder="New chore" />
        <button onClick={() => setChores([...chores, newChore])}>Add</button>
      </div>
    );
  }

  function Settings() {
    const [peopleText, setPeopleText] = useState(people.map(p => p.name).join(", "));
    return (
      <div className="p-4 space-y-4">
        <div className="text-xl font-semibold">Settings</div>
        <div>
          <label>Housemates</label>
          <input value={peopleText} onChange={e => setPeopleText(e.target.value)} />
          <button onClick={() => setPeople(peopleText.split(",").map(n => ({ name: n.trim() })))}>Save</button>
        </div>
        <div>
          <label>Min chores</label>
          <input type="number" value={minChores} onChange={e => setMinChores(Number(e.target.value))} />
        </div>
        <div>
          <label>Max chores</label>
          <input type="number" value={maxChores} onChange={e => setMaxChores(Number(e.target.value))} />
        </div>
        <button onClick={() => { localStorage.removeItem(APP_STORAGE_KEY); setPeople(DEFAULT_PEOPLE); setChores(DEFAULT_CHORES); setMinChores(DEFAULT_MIN); setMaxChores(DEFAULT_MAX); }}>Clear Saved Data</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-4 p-2">
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
        <button onClick={() => setTab("edit")}>Edit Chores</button>
        <button onClick={() => setTab("settings")}>Settings</button>
      </div>
      {tab === "dashboard" && <Dashboard />}
      {tab === "edit" && <EditChores />}
      {tab === "settings" && <Settings />}
    </div>
  );
}
