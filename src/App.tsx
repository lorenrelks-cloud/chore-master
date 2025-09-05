import React, { useEffect, useMemo, useState } from 'react'

type Person = { name: string, email?: string }
type Chore = { id: number, name: string, area?: string, weight: number, freq: 'weekly' | 'every2' | 'monthly' | 'quarterly' }
type Assignment = { person: string, choreId: number, name: string, area?: string, weight: number }

const DEFAULT_PEOPLE: Person[] = [
  { name: 'Loren', email: 'thereallorenelks@gmail.com' },
  { name: 'Zach', email: 'zachlamason@gmail.com' },
  { name: 'Tristyn', email: 'tristynelks@gmail.com' },
]

const DEFAULT_CHORES: Chore[] = [
  { id: 1, name: 'Sweep stairs', area: 'Stairs', weight: 3, freq: 'weekly' },
  { id: 2, name: 'Dusting', area: 'Living Room', weight: 3, freq: 'weekly' },
  { id: 3, name: 'Clean sink', area: 'Kitchen', weight: 2, freq: 'weekly' },
  { id: 4, name: 'Side tables', area: 'Living Room', weight: 1, freq: 'weekly' },
  { id: 5, name: 'Change Filter', area: 'Upstairs', weight: 4, freq: 'monthly' },
  { id: 6, name: 'Clean baseboards', area: 'All Rooms', weight: 4, freq: 'quarterly' },
]

const LS_KEY = 'hcb.state.v1'

function loadState() { try{const raw=localStorage.getItem(LS_KEY);return raw?JSON.parse(raw):null}catch{return null} }
function saveState(state:any){try{localStorage.setItem(LS_KEY,JSON.stringify(state))}catch{}}

function crlfEncode(body:string){return encodeURIComponent(body).replace(/%0A/g,'%0D%0A')}

export default function App(){
  const persisted=loadState()
  const [people,setPeople]=useState<Person[]>(persisted?.people??DEFAULT_PEOPLE)
  const [chores,setChores]=useState<Chore[]>(persisted?.chores??DEFAULT_CHORES)
  const [activeTab,setActiveTab]=useState<'dashboard'|'edit'|'settings'>('dashboard')
  const [cycleWeeks,setCycleWeeks]=useState<number>(4)
  const [minTarget,setMinTarget]=useState<number>(8)
  const [maxTarget,setMaxTarget]=useState<number>(12)

  useEffect(()=>{saveState({people,chores})},[people,chores])

  const schedule=useMemo(()=>{
    const weeks:{week:number,assignments:Assignment[],loads:Record<string,number>}[]=[]
    const ppl=people.map(p=>p.name)
    for(let w=0;w<cycleWeeks;w++){
      const loads:Record<string,number>=Object.fromEntries(ppl.map(p=>[p,0]))
      const asgns:Assignment[]=[]
      const occ:Chore[]=[]
      for(const c of chores){
        let add=0
        if(c.freq==='weekly') add=1
        else if(c.freq==='every2') add=(w%2===0)?1:0
        else if(c.freq==='monthly') add=(w%4===(c.id-1)%4)?1:0
        else if(c.freq==='quarterly') add=(w%12===0)?ppl.length:0
        for(let i=0;i<add;i++) occ.push(c)
      }
      occ.sort((a,b)=>b.weight-a.weight||a.name.localeCompare(b.name))
      for(const job of occ){
        const taken=new Set(asgns.filter(a=>a.choreId===job.id).map(a=>a.person))
        const candidates=ppl.filter(p=>!taken.has(p))
        const pool=(job.freq==='quarterly'&&candidates.length)?candidates:ppl
        const pick=pool.map(p=>({p,load:loads[p],over:loads[p]>=maxTarget}))
          .sort((a,b)=>(a.over===b.over?a.load-b.load:(a.over?1:-1))||a.p.localeCompare(b.p))[0].p
        asgns.push({person:pick,choreId:job.id,name:job.name,area:job.area,weight:job.weight})
        loads[pick]+=job.weight
      }
      weeks.push({week:w+1,assignments:asgns,loads})
    }
    return weeks
  },[people,chores,cycleWeeks,minTarget,maxTarget])

  function addChore(){
    const name=(document.getElementById('c_name') as HTMLInputElement).value.trim()
    const area=(document.getElementById('c_area') as HTMLInputElement).value.trim()
    const weight=Number((document.getElementById('c_weight') as HTMLInputElement).value||2)
    const freq=((document.getElementById('c_freq') as HTMLSelectElement).value||'weekly') as Chore['freq']
    if(!name) return
    const id=(chores.reduce((m,c)=>Math.max(m,c.id),0)||0)+1
    setChores([...chores,{id,name,area,weight,freq}])
    ;(document.getElementById('c_name') as HTMLInputElement).value=''
    ;(document.getElementById('c_area') as HTMLInputElement).value=''
  }

  function composeEmails(){
    const w=schedule[0]
    for(const p of people){
      if(!p.email) continue
      const mine=w.assignments.filter(a=>a.person===p.name)
      const lines=[`Hi ${p.name},`,'',`Here are your chores for this week (Week ${w.week}).`,'',
        ...(mine.length?mine.map(a=>`- ${a.name}${a.area?` [${a.area}]`:''} (w${a.weight})`):['- none -']),
        '',`Total weekly load: ${mine.reduce((s,a)=>s+a.weight,0)}`,'','Have a great week!']
      const body=lines.join('\n')
      const url=`mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent("This Week's Chores")}&body=${crlfEncode(body)}`
      window.open(url,'_blank')
    }
  }
  function clearSaved(){localStorage.removeItem(LS_KEY);window.location.reload()}
  function resetDefaults(){setChores(DEFAULT_CHORES)}

  return (<div className='max-w-6xl mx-auto p-6 space-y-4'>
    <div className='flex items-center justify-between'>
      <h1 className='text-2xl font-bold'>Housemate Chore Balancer</h1>
      <div className='flex gap-3 text-sm'>
        <button className={'tab '+(activeTab==='dashboard'?'tab-active':'')} onClick={()=>setActiveTab('dashboard')}>Dashboard</button>
        <button className={'tab '+(activeTab==='edit'?'tab-active':'')} onClick={()=>setActiveTab('edit')}>Edit Chores</button>
        <button className={'tab '+(activeTab==='settings'?'tab-active':'')} onClick={()=>setActiveTab('settings')}>Settings</button>
      </div>
    </div>

    {activeTab==='dashboard'&&(<div className='space-y-6'>
      <div className='flex items-center gap-4 text-sm'>
        <button className='ml-auto px-3 py-2 rounded bg-blue-600 text-white' onClick={composeEmails}>Compose this week's emails</button>
      </div>
      {schedule.map(week=>(<div key={week.week} className='bg-white border rounded-xl p-4 space-y-3'>
        <div className='font-semibold mb-2'>Week {week.week}</div>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          {people.map(p=>{
            const mine=week.assignments.filter(a=>a.person===p.name)
            return(<div key={p.name} className='border rounded-lg p-3 bg-slate-50'>
              <div className='font-medium'>{p.name} <span className='text-xs text-slate-500'>load {week.loads[p.name]}</span></div>
              <ul className='list-disc ml-5 text-sm mt-1'>
                {mine.length?mine.map((a,i)=>(<li key={i}>{a.name}{a.area?` [${a.area}]`:''} (w{a.weight})</li>)):<li className='italic text-slate-400'>—</li>}
              </ul>
            </div>)
          })}
        </div>
      </div>))}
    </div>)}

    {activeTab==='edit'&&(<div className='space-y-6'>
      <div className='bg-white border rounded-xl p-4 space-y-3'>
        <div className='flex items-center justify-between'><h2 className='font-semibold'>Add a Chore</h2>
        <button className='text-xs px-2 py-1 rounded border' onClick={resetDefaults}>Reset to Defaults</button></div>
        <div className='grid grid-cols-1 md:grid-cols-12 gap-2 text-sm'>
          <input id='c_name' placeholder='Chore name' className='md:col-span-4 border rounded px-2 py-1'/>
          <input id='c_area' placeholder='Location' className='md:col-span-3 border rounded px-2 py-1'/>
          <input id='c_weight' type='number' min={1} max={5} defaultValue={2} className='md:col-span-2 border rounded px-2 py-1'/>
          <select id='c_freq' className='md:col-span-2 border rounded px-2 py-1'>
            <option value='weekly'>Weekly</option><option value='every2'>Every 2 Weeks</option>
            <option value='monthly'>Monthly (staggered)</option><option value='quarterly'>Quarterly (group week)</option>
          </select>
          <button onClick={addChore} className='md:col-span-1 px-3 py-2 rounded bg-blue-600 text-white'>Add</button>
        </div>
      </div>
      <div className='bg-white border rounded-xl p-4'><h2 className='font-semibold mb-2'>Chore List</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm'>
          {chores.map(c=>(<div key={c.id} className='flex items-center justify-between border rounded px-2 py-1'>
            <div><div className='font-medium'>{c.name} <span className='text-xs text-slate-500'>[{c.area??'—'}]</span></div>
            <div className='text-xs text-slate-500'>w{c.weight} • {c.freq}</div></div>
            <button className='text-red-600 text-xs' onClick={()=>setChores(chores.filter(x=>x.id!==c.id))}>Remove</button></div>))}
        </div>
      </div>
    </div>)}

    {activeTab==='settings'&&(<div className='space-y-4'>
      <div className='bg-white border rounded-xl p-4 space-y-3'>
        <h2 className='font-semibold'>Settings</h2>
        <label className='block text-sm'>Cycle weeks <input className='ml-2 border rounded px-2 py-1 w-20' type='number' min={1} max={12} value={cycleWeeks} onChange={e=>setCycleWeeks(Number(e.target.value)||4)}/></label>
        <label className='block text-sm'>Target min <input className='ml-2 border rounded px-2 py-1 w-20' type='number' value={minTarget} onChange={e=>setMinTarget(Number(e.target.value)||8)}/></label>
        <label className='block text-sm'>Target max <input className='ml-2 border rounded px-2 py-1 w-20' type='number' value={maxTarget} onChange={e=>setMaxTarget(Number(e.target.value)||12)}/></label>
        <button className='px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200' onClick={clearSaved}>Clear saved data</button>
      </div>
    </div>)}
  </div>)
}
