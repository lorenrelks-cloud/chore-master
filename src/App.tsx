import React, { useState, useEffect } from "react"
import { supabase } from "./supabaseClient"

type Person = {
  id: number
  name: string
}

type Chore = {
  id: number
  name: string
  area: string
  weight: number
  freq: string
}

type Setting = {
  id: number
  minchores: number
  maxchores: number
}

function App() {
  const [tab, setTab] = useState("dashboard")
  const [people, setPeople] = useState<Person[]>([])
  const [chores, setChores] = useState<Chore[]>([])
  const [settings, setSettings] = useState<Setting | null>(null)

  // Fetch people, chores, and settings from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("*")
      if (peopleError) console.error("People error:", peopleError)
      else setPeople(peopleData || [])

      const { data: choresData, error: choresError } = await supabase
        .from("chores")
        .select("*")
      if (choresError) console.error("Chores error:", choresError)
      else setChores(choresData || [])

      const { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .single()
      if (settingsError) console.error("Settings error:", settingsError)
      else setSettings(settingsData)
    }

    fetchData()
  }, [])

  const saveSettings = async () => {
    if (!settings) return
    const { error } = await supabase
      .from("settings")
      .update({
        minchores: settings.minchores,
        maxchores: settings.maxchores,
      })
      .eq("id", settings.id)
    if (error) console.error("Save settings error:", error)
    else alert("✅ Settings saved to Supabase!")
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      {/* Navigation Tabs */}
      <nav style={{ marginBottom: "20px" }}>
        <button onClick={() => setTab("dashboard")}>Dashboard</button>
        <button onClick={() => setTab("chores")}>Edit Chores</button>
        <button onClick={() => setTab("settings")}>Settings</button>
      </nav>

      {/* Dashboard */}
      {tab === "dashboard" && (
        <div>
          <h1>Housemate Chore Balancer</h1>
          <p style={{ color: "green" }}>
            ✅ Changes here are saved to Supabase and shared with all housemates.
          </p>
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
                {c.name} — {c.area} — {c.freq}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Edit Chores */}
      {tab === "chores" && (
        <div>
          <h2>Edit Chores</h2>
          <p>Chore editing UI coming soon (still saves to Supabase).</p>
          <ul>
            {chores.map((c) => (
              <li key={c.id}>
                {c.name} — {c.area} — {c.freq}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Settings */}
      {tab === "settings" && settings && (
        <div>
          <h2>Settings</h2>
          <label>
            Min chores per person:
            <input
              type="number"
              value={settings.minchores}
              onChange={(e) =>
                setSettings({ ...settings, minchores: parseInt(e.target.value) })
              }
            />
          </label>
          <br />
          <label>
            Max chores per person:
            <input
              type="number"
              value={settings.maxchores}
              onChange={(e) =>
                setSettings({ ...settings, maxchores: parseInt(e.target.value) })
              }
            />
          </label>
          <br />
          <button onClick={saveSettings}>Save Settings</button>
        </div>
      )}
    </div>
  )
}

export default App
