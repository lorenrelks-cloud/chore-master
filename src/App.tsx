import React, { useEffect, useMemo, useState } from "react";

/* Types */
type FreqKey = "weekly" | "twice_week" | "every_2_weeks" | "monthly" | "quarterly";
type Chore = { id: number; name: string; area?: string; weight: number; freq: FreqKey; notes?: string };
type Person = { name: string; email?: string };
type WeekAssignment = {
  week: number;
  assignments: { person: string; choreId: number; choreName: string; area?: string; weight: number }[];
  loads: Record<string, number>;
  counts: Record<string, number>;
};

/* Constants */
const APP_STORAGE_KEY = "chore-master:v2";
const DEFAULT_MIN = 8;
const DEFAULT_MAX = 10;

const DEFAULT_PEOPLE: Person[] = [
  { name: "Loren", email: "" },
  { name: "Zach", email: "" },
  { name: "Tristyn", email: "" },
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

/* Utility */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* App */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [people, setPeople] = useState<Person[]>(DEFAULT_PEOPLE);
  const [chores, setChores] = useState<Chore[]>(DEFAULT_CHORES);

  const [minChores, setMinChores] = useState<number>(DEFAULT_MIN);
  const [maxChores, setMaxChores] = useState<number>(DEFAULT_MAX);
  const [avoidRepeats, setAvoidRepeats] = useState<boolean>(true);
  const [noDupPerWeek, setNoDupPerWeek] = useState<boolean>(true);
  const [cycleWeeks, setCycleWeeks] = useState<number>(4);
  const [cycleStart, setCycleStart] = useState<string>("");
  const [flash, setFlash] = useState<string>("");

  const [tab, setTab] = useState<"dashboard" | "edit" | "settings">("dashboard");

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
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const payload = { people, chores, minChores, maxChores, avoidRepeats, noDupPerWeek, cycleWeeks, cycleStart };
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(payload));
  }, [loaded, people, chores, minChores, maxChores, avoidRepeats, noDupPerWeek, cycleWeeks, cycleStart]);

  /* --- Your assignment logic remains unchanged (not pasted fully here for brevity). --- */
  /* Assume weeks[] is produced as before with counts and loads enforced. */

  const weeks: WeekAssignment[] = useMemo(() => {
    // keep all your existing assignment code here (unchanged)
    return []; // placeholder for brevity
  }, [people, chores, minChores, maxChores, avoidRepeats, noDupPerWeek, cycleWeeks]);

  function groupedListFor(personName: string, widx: number) {
    const week = weeks[widx] || weeks[0];
    const mine = week.assignments.filter(a => a.person === personName);
    const g = mine.reduce<Record<string, { name: string; area?: string; weight: number; count: number }>>((acc, a) => {
      const key = `${a.choreId}|${a.area ?? ""}`;
      if (!acc[key]) acc[key] = { name: a.choreName, area: a.area, weight: a.weight, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {});
    const items = Object.values(g).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
    const totalLoad = items.reduce((s, it) => s + it.weight * it.count, 0);
    const totalCount = mine.length;
    return { items, totalLoad, totalCount };
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
                      {p.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({totalCount} chores • load {totalLoad})
                      </span>
                    </div>
                    <ul className="text-sm list-disc pl-4">
                      {items.map((it, i) => (
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
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {tab === "dashboard" && <Dashboard />}
      {/* keep EditChores and Settings components as-is */}
    </div>
  );
}
