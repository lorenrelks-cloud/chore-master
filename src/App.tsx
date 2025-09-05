// src/App.tsx
import React, { useState, useEffect } from "react";

interface Chore {
  id: number;
  name: string;
  location: string;
  weight: number;
  frequency: "Weekly" | "Quarterly";
}

interface Assignment {
  housemate: string;
  chores: Chore[];
  load: number;
}

const defaultChores: Chore[] = [
  { id: 1, name: "Clean sink", location: "Kitchen", weight: 2, frequency: "Weekly" },
  { id: 2, name: "Sweep stairs", location: "Stairs", weight: 3, frequency: "Weekly" },
  { id: 3, name: "Dusting", location: "Living Room", weight: 3, frequency: "Weekly" },
  { id: 4, name: "Change Filter", location: "Upstairs", weight: 4, frequency: "Quarterly" },
  { id: 5, name: "Clean baseboards", location: "All Rooms", weight: 4, frequency: "Quarterly" },
];

const housemates = ["Loren", "Zach", "Tristyn"];
const weeks = [1, 2, 3, 4];

function App() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "edit" | "settings">("dashboard");

  // Load chores from localStorage or defaults
  useEffect(() => {
    const stored = localStorage.getItem("chores");
    if (stored) {
      setChores(JSON.parse(stored));
    } else {
      setChores(defaultChores);
    }
  }, []);

  // Persist chores
  useEffect(() => {
    localStorage.setItem("chores", JSON.stringify(chores));
  }, [chores]);

  // Balance chores with quarterly logic
  const generateAssignments = (): Record<number, Assignment[]> => {
    const results: Record<number, Assignment[]> = {};
    weeks.forEach((week) => {
      const assignments: Assignment[] = housemates.map((h) => ({ housemate: h, chores: [], load: 0 }));

      // Quarterly chores: group task
      const quarterly = chores.filter((c) => c.frequency === "Quarterly" && c.name.includes(week.toString()) === false);
      if (quarterly.length > 0 && week === 1) {
        quarterly.forEach((chore) => {
          assignments.forEach((a) => {
            a.chores.push(chore);
            a.load += chore.weight;
          });
        });
      }

      // Weekly chores: random distribution until balanced
      const weeklyChores = chores.filter((c) => c.frequency === "Weekly");
      let pool = [...weeklyChores];
      while (pool.length > 0) {
        const chore = pool.pop();
        if (!chore) break;
        // Assign to lowest load person
        const target = assignments.reduce((prev, curr) =>
          curr.load < prev.load ? curr : prev
        );
        target.chores.push(chore);
        target.load += chore.weight;
      }

      results[week] = assignments;
    });
    return results;
  };

  const assignments = generateAssignments();

  // Reset to defaults
  const resetChores = () => setChores(defaultChores);

  // Clear localStorage
  const clearData = () => {
    localStorage.clear();
    setChores(defaultChores);
  };

  return (
    <div className="p-6 font-sans bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-blue-700 mb-4">Housemate Chore Balancer</h1>
      <div className="flex gap-4 border-b mb-6">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`pb-2 ${activeTab === "dashboard" ? "border-b-2 border-blue-500 font-semibold" : ""}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={`pb-2 ${activeTab === "edit" ? "border-b-2 border-blue-500 font-semibold" : ""}`}
        >
          Edit Chores
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-2 ${activeTab === "settings" ? "border-b-2 border-blue-500 font-semibold" : ""}`}
        >
          Settings
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div>
          {weeks.map((week) => (
            <div key={week} className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Week {week}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assignments[week].map((a) => (
                  <div key={a.housemate} className="p-4 bg-white shadow rounded">
                    <h3 className="font-bold">{a.housemate} <span className="text-sm font-normal text-gray-500">load {a.load}</span></h3>
                    <ul className="list-disc ml-5">
                      {a.chores.map((c) => (
                        <li key={c.id}>{c.name} [{c.location}] (w{c.weight})</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "edit" && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Edit Chores</h2>
          <button onClick={resetChores} className="px-3 py-1 bg-yellow-400 text-black rounded mb-4">Reset to Defaults</button>
          <ul>
            {chores.map((c) => (
              <li key={c.id}>{c.name} — {c.location} ({c.frequency})</li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === "settings" && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Settings</h2>
          <button onClick={clearData} className="px-4 py-2 bg-red-600 text-white rounded">
            Clear Saved Data
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
