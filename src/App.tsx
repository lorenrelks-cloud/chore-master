import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface Person {
  id: number;
  name: string;
}

interface Chore {
  id: number;
  name: string;
  area: string;
  weight: number;
  freq: "weekly" | "monthly" | "quarterly";
}

interface Settings {
  id: number;
  minchores: number;
  maxchores: number;
}

type Tab = "dashboard" | "edit" | "settings";

function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [people, setPeople] = useState<Person[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const { data: peopleData } = await supabase.from("people").select("*");
      if (peopleData) setPeople(peopleData);

      const { data: choresData } = await supabase.from("chores").select("*");
      if (choresData) setChores(choresData);

      const { data: settingsData } = await supabase.from("settings").select("*").single();
      if (settingsData) setSettings(settingsData);

      setLoading(false);
    };

    loadData();

    // Realtime updates
    const channel = supabase
      .channel("chore-updates")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save people
  const savePeople = async (newPeople: Person[]) => {
    setPeople(newPeople);
    await supabase.from("people").delete().neq("id", 0);
    await supabase.from("people").insert(newPeople);
  };

  // Save chores
  const saveChores = async (newChores: Chore[]) => {
    setChores(newChores);
    await supabase.from("chores").delete().neq("id", 0);
    await supabase.from("chores").insert(newChores);
  };

  // Save settings
  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await supabase.from("settings").upsert(newSettings);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <nav style={{ marginBottom: "20px" }}>
        <a
          href="#"
          onClick={() => setTab("dashboard")}
          style={{ marginRight: "20px" }}
        >
          Dashboard
        </a>
        <a
          href="#"
          onClick={() => setTab("edit")}
          style={{ marginRight: "20px" }}
        >
          Edit Chores
        </a>
        <a href="#" onClick={() => setTab("settings")}>
          Settings
        </a>
      </nav>

      <h1>Housemate Chore Balancer</h1>

      <p style={{ color: "green", fontWeight: "bold" }}>
        ✅ Changes here are saved to Supabase and shared with all housemates.
      </p>

      {tab === "dashboard" && (
        <div>
          <h2>People</h2>
          <ul>
            {people.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>

          <h2>Chores</h2>
          <ul>
            {chores.map((c) => (
              <li key={c.id}>
                {c.name} ({c.freq}, weight {c.weight})
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "edit" && (
        <div>
          <h2>Edit Chores</h2>
          <p>You can add or remove chores below. Changes sync to everyone.</p>
          <button
            onClick={() =>
              saveChores([
                ...chores,
                {
                  id: Date.now(),
                  name: "New Chore",
                  area: "Kitchen",
                  weight: 1,
                  freq: "weekly",
                },
              ])
            }
          >
            Add Chore
          </button>
          <ul>
            {chores.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </div>
      )}

      {tab === "settings" && (
        <div>
          <h2>Settings</h2>
          {settings ? (
            <div>
              <p>
                Min chores: {settings.minchores}, Max chores: {settings.maxchores}
              </p>
              <button
                onClick={() =>
                  saveSettings({
                    ...settings,
                    minchores: settings.minchores + 1,
                  })
                }
              >
                +1 Min
              </button>
            </div>
          ) : (
            <p>No settings found</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
