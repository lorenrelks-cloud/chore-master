import React, { useState, useEffect } from 'react';

type Chore = {
  id: number;
  name: string;
  location: string;
  weight: number;
  frequency: 'weekly' | 'monthly' | 'quarterly';
};

const defaultChores: Chore[] = [
  { id: 1, name: 'Dusting', location: 'Living Room', weight: 3, frequency: 'weekly' },
  { id: 2, name: 'Clean sink', location: 'Kitchen', weight: 2, frequency: 'weekly' },
  { id: 3, name: 'Sweep stairs', location: 'Stairs', weight: 3, frequency: 'weekly' },
  { id: 4, name: 'Change Filter', location: 'Upstairs', weight: 4, frequency: 'quarterly' },
  { id: 5, name: 'Clean baseboards', location: 'All Rooms', weight: 4, frequency: 'quarterly' },
];

const housemates = ['Loren', 'Zach', 'Tristyn'];

const App: React.FC = () => {
  const [chores, setChores] = useState<Chore[]>(() => {
    const saved = localStorage.getItem('chores');
    return saved ? JSON.parse(saved) : defaultChores;
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'edit' | 'settings'>('dashboard');

  useEffect(() => {
    localStorage.setItem('chores', JSON.stringify(chores));
  }, [chores]);

  const resetToDefaults = () => {
    setChores(defaultChores);
    localStorage.setItem('chores', JSON.stringify(defaultChores));
  };

  const clearAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const assignChores = () => {
    const weeks: Record<number, Record<string, { tasks: Chore[]; load: number }>> = {};
    for (let week = 1; week <= 4; week++) {
      weeks[week] = {};
      housemates.forEach(h => (weeks[week][h] = { tasks: [], load: 0 }));
    }

    const weekly = chores.filter(c => c.frequency === 'weekly');
    const monthly = chores.filter(c => c.frequency === 'monthly');
    const quarterly = chores.filter(c => c.frequency === 'quarterly');

    // Assign quarterly: group activity, all get same task that week
    quarterly.forEach((chore, i) => {
      const week = (i % 4) + 1;
      housemates.forEach(h => {
        weeks[week][h].tasks.push(chore);
        weeks[week][h].load += chore.weight;
      });
    });

    const assignRandom = (choreList: Chore[], isMonthly = false) => {
      choreList.forEach((chore, i) => {
        const week = isMonthly ? ((i % 4) + 1) : ((Math.floor(Math.random() * 4)) + 1);
        const mate = housemates[Math.floor(Math.random() * housemates.length)];
        weeks[week][mate].tasks.push(chore);
        weeks[week][mate].load += chore.weight;
      });
    };

    assignRandom(weekly);
    assignRandom(monthly, true);

    return weeks;
  };

  const schedule = assignChores();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-blue-700 mb-4">Housemate Chore Balancer</h1>
      <div className="flex space-x-4 border-b mb-6">
        <button className={`pb-2 ${activeTab === 'dashboard' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={`pb-2 ${activeTab === 'edit' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('edit')}>Edit Chores</button>
        <button className={`pb-2 ${activeTab === 'settings' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('settings')}>Settings</button>
      </div>

      {activeTab === 'dashboard' && (
        <div>
          {Object.entries(schedule).map(([week, mates]) => (
            <div key={week} className="mb-6">
              <h2 className="font-semibold mb-2">Week {week}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(mates).map(([mate, { tasks, load }]) => (
                  <div key={mate} className="p-4 bg-white shadow rounded">
                    <h3 className="font-semibold">{mate} <span className="text-sm text-gray-500">load {load}</span></h3>
                    <ul className="list-disc list-inside text-sm mt-2">
                      {tasks.map(t => (
                        <li key={t.id}>{t.name} [{t.location}] (w{t.weight})</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'edit' && (
        <div>
          <h2 className="font-semibold mb-2">Edit Chores</h2>
          <button onClick={resetToDefaults} className="mb-4 px-3 py-1 bg-yellow-500 text-white rounded">Reset to Defaults</button>
          <ul>
            {chores.map(c => (
              <li key={c.id} className="mb-2">{c.name} [{c.location}] (w{c.weight}, {c.frequency})</li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'settings' && (
        <div>
          <h2 className="font-semibold mb-2">Settings</h2>
          <button onClick={clearAllData} className="px-3 py-1 bg-red-600 text-white rounded">Clear saved data</button>
        </div>
      )}
    </div>
  );
};

export default App;