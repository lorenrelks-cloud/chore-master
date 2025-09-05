import React, { useEffect, useMemo, useState } from "react";

/** ---------- Types ---------- */
type Freq = "Weekly" | "Quarterly";
type Tab = "dashboard" | "edit" | "settings";

interface Chore {
  id: number;
  name: string;
  location: string;
  weight: number; // 1..5
  frequency: Freq;
}

interface Assignment {
  housemate: string;
  chores: Chore[];
  load: number;
}

/** ---------- Constants ---------- */
const HOUSEMATES = ["Loren", "Zach", "Tristyn"];
const WEEKS = [1, 2, 3, 4];

const DEFAULT_CHORES: Chore[] = [
  // Weekly (enough variety so nobody ends empty)
  { id: 1, name: "Clean sink", location: "Kitchen", weight: 2, frequency: "Weekly" },
  { id: 2, name: "Sweep stairs", location: "Stairs", weight: 3, frequency: "Weekly" },
  { id: 3, name: "Dusting", location: "Living Room", weight: 3, frequency: "Weekly" },
  { id: 4, name: "Wipe counters", location: "Kitchen", weight: 2, frequency: "Weekly" },
  { id: 5, name: "Side tables", location: "Living Room", weight: 1, frequency: "Weekly" },
  { id: 6, name: "Coffee table", location: "Living Room", weight: 1, frequency: "Weekly" },
  { id: 7, name: "Wipe washer & dryer", location: "Laundry Room", weight: 2, frequency: "Weekly" },
  { id: 8, name: "Dining room table", location: "Living Room", weight: 1, frequency: "Weekly" },

  // Quarterly (group week = everyone same chore same week)
  { id: 100, name: "Change Filter", location: "Upstairs", weight: 4, frequency: "Quarterly" },
  { id: 101, name: "Clean baseboards", location: "All Rooms", weight: 4, frequency: "Quarterly" },
  { id: 102, name: "Wash curtains", location: "Living Room", weight: 4, frequency: "Quarterly" },
];

const LS_KEY = "chore-master.v1";

/** ---------- Helpers ---------- */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeChores(input: any): Chore[] {
  // Make sure we end up with a non-empty, valid list.
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_CHORES.slice();

  const out: Chore[] = [];
  input.forEach((raw: any, idx: number) => {
    const id = typeof raw?.id === "number" ? raw.id : 1000 + idx;
    const name = String(raw?.name ?? "").trim();
    const location = String(raw?.location ?? "").trim();
    const weightN = Number(raw?.weight);
    const weight = clamp(Number.isFinite(weightN) ? weightN : 2, 1, 5);
    const freq = (raw?.frequency === "Quarterly" ? "Quarterly" : "Weekly") as Freq;

    if (name) {
      out.push({ id, name, location, weight, frequency: freq });
    }
  });

  return out.length ? out : DEFAULT_CHORES.slice();
}

/** ---------- App ---------- */
export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [chores, setChores] = useState<Chore[]>(() => {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (!s) return DEFAULT_CHORES.slice();
      const parsed = JSON.parse(s);
      return normalizeChores(parsed);
    } catch {
      return DEFAULT_CHORES.slice();
    }
  });

  // Persist whenever chores change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(chores));
  }, [chores]);

  /** ---- Assignment engine ----
   *  - Week 1: add every Quarterly chore to EVERYONE (group week)
   *  - Every week: assign each Weekly chore to ONE person (the lowest current load).
   *  - Randomize chore order each week for variety.
   */
  const schedule = useMemo(() => {
    const perWeek: Record<number, Assignment[]> = {};

    // Pre-split chores
    const weekly = chores.filter(c => c.frequency === "Weekly");
    const quarterly = chores.filter(c => c.frequency === "Quarterly");

    for (const week of WEEKS) {
      const assignments: Assignment[] = HOUSEMATES.map(h => ({
        housemate: h,
        chores: [],
        load: 0,
      }));

      // WEEK 1 -> group quarterly chores (everyone gets each quarterly chore)
      if (week === 1 && quarterly.length) {
        for (const qc of quarterly) {
          for (const a of assignments) {
            a.chores.push(qc);
            a.load += qc.weight;
          }
        }
      }

      // Weekly chores for this week (randomized order for variety)
      const pool = shuffled(weekly);

      // Assign each weekly chore once (to the current lowest-load person)
      for (const job of pool) {
        // pick the lowest load person (stable by name for tie-breaker)
        const target = assignments
          .slice()
          .sort((a, b) => (a.load - b.load) || a.housemate.localeCompare(b.housemate))[0];

        target.chores.push(job);
        target.load += job.weight;
      }

      perWeek[week] = assignments;
    }

    return perWeek;
  }, [chores]);

  /** ---------- UI actions ---------- */
  const addChore = (c: Omit<Chore, "id">) => {
    const nextId = chores.length ? Math.max(...chores.map(ch => ch.id)) + 1 : 1;
    setChores(prev => [...prev, { id: nextId, ...c }]);
  };

  const deleteChore = (id: number) => setChores(prev => prev.filter(c => c.id !== id));

  const resetDefaults = () => setChores(DEFAULT_CHORES.slice());

  const clearSaved = () => {
    localStorage.removeItem(LS_KEY);
    setChores(DEFAULT_CHORES.slice());
  };

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="px-6 py-5">
        <h1 className="text-2xl font-bold">Housemate Chore Balancer</h1>
        <nav className="mt-4 flex gap-6 border-b">
          <button
            onClick={() => setTab("dashboard")}
            className={`pb-2 ${tab === "dashboard" ? "border-b-2 border-blue-600 font-semibold" : "text-gray-600"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab("edit")}
            className={`pb-2 ${tab === "edit" ? "border-b-2 border-blue-600 font-semibold" : "text-gray-600"}`}
          >
            Edit Chores
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`pb-2 ${tab === "settings" ? "border-b-2 border-blue-600 font-semibold" : "text-gray-600"}`}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="px-6 pb-12 max-w-6xl mx-auto">
        {tab === "dashboard" && (
          <div className="space-y-8">
            {WEEKS.map(week => (
              <section key={week} className="space-y-3">
                <h2 className="text-lg font-semibold">Week {week}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {schedule[week].map(block => (
                    <div key={block.housemate} className="bg-white rounded-xl border shadow-sm p-4">
                      <div className="flex items-baseline justify-between">
                        <div className="font-semibold">{block.housemate}</div>
                        <div className="text-sm text-gray-500">load {block.load}</div>
                      </div>
                      {block.chores.length === 0 ? (
                        <div className="text-sm text-gray-400 mt-2">—</div>
                      ) : (
                        <ul className="mt-2 list-disc pl-6 text-sm leading-6">
                          {block.chores.map(ch => (
                            <li key={ch.id}>
                              {ch.name} [{ch.location}] (w{ch.weight})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {tab === "edit" && <EditChores chores={chores} addChore={addChore} deleteChore={deleteChore} onReset={resetDefaults} />}

        {tab === "settings" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Settings</h2>
            <button
              onClick={clearSaved}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Clear Saved Data
            </button>
            <div className="text-sm text-gray-500">
              This clears your browser’s saved chores and reloads defaults.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** ---------- Edit panel ---------- */
function EditChores({
  chores,
  addChore,
  deleteChore,
  onReset,
}: {
  chores: Chore[];
  addChore: (c: Omit<Chore, "id">) => void;
  deleteChore: (id: number) => void;
  onReset: () => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [weight, setWeight] = useState(2);
  const [frequency, setFrequency] = useState<Freq>("Weekly");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return;
    addChore({
      name: nm,
      location: location.trim(),
      weight: clamp(weight, 1, 5),
      frequency,
    });
    setName("");
    setLocation("");
    setWeight(2);
    setFrequency("Weekly");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Edit Chores</h2>
        <button onClick={onReset} className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-black">
          Reset to Defaults
        </button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white rounded-xl border p-4">
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Chore name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Location (e.g., Kitchen)"
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={5}
          className="border rounded-lg px-3 py-2"
          placeholder="Weight 1-5"
          value={weight}
          onChange={e => setWeight(Number(e.target.value))}
        />
        <select
          className="border rounded-lg px-3 py-2"
          value={frequency}
          onChange={e => setFrequency(e.target.value as Freq)}
        >
          <option value="Weekly">Weekly</option>
          <option value="Quarterly">Quarterly</option>
        </select>
        <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Add Chore</button>
      </form>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b font-semibold">Current Chores</div>
        <ul className="divide-y">
          {chores.length === 0 ? (
            <li className="p-4 text-gray-500 text-sm">No chores.</li>
          ) : (
            chores.map(ch => (
              <li key={ch.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {ch.name} <span className="text-gray-500 font-normal">[{ch.location}]</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {ch.frequency} • weight {ch.weight}
                  </div>
                </div>
                <button
                  onClick={() => deleteChore(ch.id)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
