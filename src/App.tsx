import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client (env vars come from Vercel)
 * VITE_SUPABASE_URL:      https://<project-ref>.supabase.co
 * VITE_SUPABASE_ANON_KEY: your Publishable (anon) key
 */
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

// ---------- Types ----------
type FreqKey = "weekly" | "every_2_weeks" | "monthly" | "quarterly";

type Chore = {
  id: number;
  name: string;
  area?: string | null;
  weight: number;
  freq: FreqKey;
};

type Person = {
  id: number;
  name: string;
};

type SettingsRow = {
  id: number;
  minChores: number;
  maxChores: number;
};

type WeekAssignment = {
  week: number;
  assignments: {
    person: string;
    choreId: number;
    choreName: string;
    area?: string | null;
    weight: number;
    freq: FreqKey;
  }[];
  loads: Record<string, number>;
  counts: Record<string, number>;
};

// ---------- App ----------
export default function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [cycleWeeks] = useState(4);
  const [tab, setTab] = useState<"dashboard" | "edit" | "settings">("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --------- Initial load ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
          supabase.from("people").select("*").order("id", { ascending: true }),
          supabase.from("chores").select("*").order("id", { ascending: true }),
          supabase.from("settings").select("*").order("id", { ascending: true }).limit(1),
        ]);
        setPeople(p || []);
        setChores((c || []) as Chore[]);
        setSettings((s && s[0]) || { id: 1, minChores: 8, maxChores: 10 });
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();

    // --------- Realtime subscriptions ----------
    const ch = supabase
      .channel("chore-master-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "people" },
        async () => {
          const { data } = await supabase.from("people").select("*").order("id");
          setPeople(data || []);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chores" },
        async () => {
          const { data } = await supabase.from("chores").select("*").order("id");
          setChores((data || []) as Chore[]);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        async () => {
          const { data } = await supabase.from("settings").select("*").order("id").limit(1);
          if (data && data[0]) setSettings(data[0]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // --------- Assignment logic ----------
  const weeks: WeekAssignment[] = useMemo(() => {
    if (!people.length || !chores.length || !settings) return [];
    const P = people.map((p) => p.name);
    const result: WeekAssignment[] = [];

    function occurrencesInWeek(chore: Chore, widx: number): number {
      switch (chore.freq) {
        case "weekly":
          return 1;
        case "every_2_weeks":
          return widx % 2 === 0 ? 1 : 0;
        case "monthly": {
          // Evenly distribute monthly chores across Weeks 1..4
          const monthly = chores.filter((c) => c.freq === "monthly");
          const idx = monthly.findIndex((c) => c.id === chore.id);
          if (idx === -1) return 0;
          const assignedWeek = idx % 4; // 0→W1, 1→W2, 2→W3, 3→W4
          return widx % 4 === assignedWeek ? 1 : 0;
        }
        case "quarterly": {
          // Stagger quarterly chores explicitly across Weeks 1,3,4
          const quarterly = chores.filter((c) => c.freq === "quarterly");
          const idx = quarterly.findIndex((c) => c.id === chore.id);
          if (idx === -1) return 0;
          const map = [0, 2, 3]; // 0→W1, 2→W3, 3→W4
          const assignedWeek = map[idx % map.length];
          return widx % 4 === assignedWeek ? 1 : 0;
        }
        default:
          return 0;
      }
    }

    for (let w = 0; w < cycleWeeks; w++) {
      const week: WeekAssignment = {
        week: w + 1,
        assignments: [],
        loads: Object.fromEntries(P.map((p) => [p, 0])),
        counts: Object.fromEntries(P.map((p) => [p, 0])),
      };

      // Build job list for the week
      const jobs: Chore[] = [];
      for (const c of chores) {
        const times = occurrencesInWeek(c, w);
        for (let i = 0; i < times; i++) jobs.push(c);
      }

      // Greedy fair distribution by count
      for (const chore of jobs) {
        const chosen = [...P].sort((a, b) => week.counts[a] - week.counts[b])[0];
        week.assignments.push({
          person: chosen,
          choreId: chore.id,
          choreName: chore.name,
          area: chore.area,
          weight: chore.weight,
          freq: chore.freq,
        });
        week.counts[chosen] += 1;
        week.loads[chosen] += chore.weight;
      }

      // Soft cap: trim if any exceed maxChores
      for (const p of P) {
        while (week.counts[p] > settings.maxChores) {
          const idx = week.assignments.findIndex((a) => a.person === p);
          if (idx === -1) break;
          const [removed] = week.assignments.splice(idx, 1);
          week.counts[p] -= 1;
          week.loads[p] -= removed.weight;
        }
      }

      result.push(week);
    }

    return result;
  }, [people, chores, settings, cycleWeeks]);

  // ---------- UI Components ----------
  function Dashboard() {
    if (!settings) return null;
    return (
      <div className="p-4 space-y-4">
        {weeks.map((week, widx) => (
          <div key={week.week} className="rounded-xl border p-3">
            <div className="font-semibold mb-2">Week {week.week}</div>
            <div className="grid md:grid-cols-3 gap-3">
              {people.map((p) => {
                const mine = week.assignments.filter((a) => a.person === p.name);
                const totalLoad = mine.reduce((s, a) => s + a.weight, 0);
                return (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="font-medium mb-1">
                      {p.name}{" "}
                      <span className="text-xs text-slate-500">
                        ({mine.length} chores • load {totalLoad})
                      </span>
                    </div>
                    <ul className="text-sm list-disc pl-4">
                      {mine.map((it, i) => (
                        <li key={i}>
                          {it.choreName}{" "}
                          <span className="text-xs">
                            ({it.freq.replace(/_/g, " ")})
                            {it.area ? ` [${it.area}]` : ""} (w{it.weight})
                          </span>
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

  function EditChores() {
    const [newChore, setNewChore] = useState<Chore>({
      id: 0,
      name: "",
      area: "",
      weight: 2,
      freq: "weekly",
    });

    async function addChore() {
      if (!newChore.name.trim()) return;
      await supabase.from("chores").insert([
        {
          name: newChore.name.trim(),
          area: newChore.area || null,
          weight: Number(newChore.weight) || 1,
          freq: newChore.freq,
        },
      ]);
      setNewChore({ id: 0, name: "", area: "", weight: 2, freq: "weekly" });
    }

    async function updateChore(c: Chore, patch: Partial<Chore>) {
      await supabase.from("chores").update(patch).eq("id", c.id);
    }

    async function removeChore(c: Chore) {
      await supabase.from("chores").delete().eq("id", c.id);
    }

    return (
      <div className="p-4 space-y-4">
        <div className="text-xl font-semibold">Edit Chores</div>
        <p className="text-sm text-red-600">
          ⚠️ Changes here are saved to the shared database and will be visible to everyone immediately.
        </p>

        <div className="space-y-2">
          {chores.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-3 border rounded px-2 py-1"
                value={c.name}
                onChange={(e) => updateChore(c, { name: e.target.value })}
              />
              <input
                className="col-span-3 border rounded px-2 py-1"
                placeholder="Area"
                value={c.area || ""}
                onChange={(e) => updateChore(c, { area: e.target.value })}
              />
              <input
                className="col-span-2 border rounded px-2 py-1"
                type="number"
                min={1}
                value={c.weight}
                onChange={(e) => updateChore(c, { weight: Number(e.target.value) })}
              />
              <select
                className="col-span-3 border rounded px-2 py-1"
                value={c.freq}
                onChange={(e) => updateChore(c, { freq: e.target.value as FreqKey })}
              >
                <option value="weekly">weekly</option>
                <option value="every_2_weeks">every_2_weeks</option>
                <option value="monthly">monthly</option>
                <option value="quarterly">quarterly</option>
              </select>
              <button
                className="col-span-1 text-red-600"
                onClick={() => removeChore(c)}
                title="Remove chore"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-12 gap-2">
          <input
            className="col-span-3 border rounded px-2 py-1"
            placeholder="Chore name"
            value={newChore.name}
            onChange={(e) => setNewChore({ ...newChore, name: e.target.value })}
          />
          <input
            className="col-span-3 border rounded px-2 py-1"
            placeholder="Area"
            value={newChore.area || ""}
            onChange={(e) => setNewChore({ ...newChore, area: e.target.value })}
          />
          <input
            className="col-span-2 border rounded px-2 py-1"
            type="number"
            min={1}
            value={newChore.weight}
            onChange={(e) => setNewChore({ ...newChore, weight: Number(e.target.value) })}
          />
          <select
            className="col-span-3 border rounded px-2 py-1"
            value={newChore.freq}
            onChange={(e) => setNewChore({ ...newChore, freq: e.target.value as FreqKey })}
          >
            <option value="weekly">weekly</option>
            <option value="every_2_weeks">every_2_weeks</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
          </select>
          <button className="col-span-1 border rounded px-2 py-1" onClick={addChore}>
            Add
          </button>
        </div>
      </div>
    );
  }

  function SettingsTab() {
    const [minC, setMinC] = useState<number>(settings?.minChores ?? 8);
    const [maxC, setMaxC] = useState<number>(settings?.maxChores ?? 10);
    const [newPerson, setNewPerson] = useState("");

    useEffect(() => {
      if (settings) {
        setMinC(settings.minChores);
        setMaxC(settings.maxChores);
      }
    }, [settings]);

    async function saveSettings() {
      if (!settings) return;
      await supabase
        .from("settings")
        .update({ minChores: minC, maxChores: maxC })
        .eq("id", settings.id);
    }

    async function addPerson() {
      const name = newPerson.trim();
      if (!name) return;
      await supabase.from("people").insert([{ name }]);
      setNewPerson("");
    }

    async function removePerson(p: Person) {
      await supabase.from("people").delete().eq("id", p.id);
    }

    return (
      <div className="p-4 space-y-6">
        <div>
          <div className="text-xl font-semibold mb-1">Settings</div>
          <p className="text-sm text-red-600">
            ⚠️ These settings are shared. Edits here will affect everyone immediately.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">Min chores / person / week</label>
          <input
            className="border rounded px-2 py-1"
            type="number"
            min={0}
            value={minC}
            onChange={(e) => setMinC(Number(e.target.value))}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm">Max chores / person / week</label>
          <input
            className="border rounded px-2 py-1"
            type="number"
            min={0}
            value={maxC}
            onChange={(e) => setMaxC(Number(e.target.value))}
          />
        </div>

        <button className="border rounded px-3 py-1" onClick={saveSettings}>
          Save Settings
        </button>

        <div className="mt-6">
          <div className="font-medium mb-2">Housemates</div>
          <div className="space-y-2">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="px-2 py-1 rounded bg-slate-100">{p.name}</div>
                <button className="text-red-600" onClick={() => removePerson(p)}>
                  remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Add housemate"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
            />
            <button className="border rounded px-3 py-1" onClick={addPerson}>
              Add
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Shell ----------
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-4 p-3 border-b">
        <button
          className={`px-3 py-1 rounded ${tab === "dashboard" ? "bg-slate-200" : "bg-white"}`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "edit" ? "bg-slate-200" : "bg-white"}`}
          onClick={() => setTab("edit")}
        >
          Edit Chores
        </button>
        <button
          className={`px-3 py-1 rounded ${tab === "settings" ? "bg-slate-200" : "bg-white"}`}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      {loading && <div className="p-4 text-sm text-slate-600">Loading…</div>}
      {error && <div className="p-4 text-sm text-red-600">Error: {error}</div>}
      {!loading && !error && (
        <>
          {tab === "dashboard" && <Dashboard />}
          {tab === "edit" && <EditChores />}
          {tab === "settings" && <SettingsTab />}
        </>
      )}
    </div>
  );
}
