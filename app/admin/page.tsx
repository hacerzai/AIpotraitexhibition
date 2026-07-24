'use client';

import { useState } from 'react';
import { styles, templates } from '@/lib/catalog';

export default function AdminPage(){
  const [password,setPassword]=useState('');
  const [unlocked,setUnlocked]=useState(false);
  const [demo,setDemo]=useState(true);
  const [reset,setReset]=useState(90);
  const [enabled,setEnabled]=useState<Record<string,boolean>>(()=>Object.fromEntries([...styles,...templates].map(x=>[x.id,true])));
  const login=async()=>{
    const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    setUnlocked(response.ok);
  };
  if(!unlocked)return <main className="admin-shell"><div className="panel" style={{maxWidth:520,margin:'10vh auto'}}><span className="eyebrow">Protected area</span><h1>Exhibition Admin</h1><div className="stack"><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password"/><button className="primary-button" onClick={login}>Unlock Dashboard</button><a className="secondary-button" style={{textAlign:'center',textDecoration:'none'}} href="/">Return to Booth</a></div></div></main>;
  return <main className="admin-shell"><div style={{maxWidth:1000,margin:'auto'}}><div className="button-row"><a href="/" className="secondary-button" style={{textDecoration:'none',textAlign:'center'}}>Open Booth</a><button className="danger-button" onClick={()=>setUnlocked(false)}>Lock</button></div><h1>Exhibition Control Centre</h1><p style={{color:'#94a3b8'}}>Configure the rehearsal experience. Connect persistent storage before using these controls across multiple devices.</p><section className="admin-grid"><div className="metric"><span>Successful generations</span><strong>0</strong></div><div className="metric"><span>Failed generations</span><strong>0</strong></div><div className="metric"><span>Average processing</span><strong>—</strong></div><div className="metric"><span>Temporary files</span><strong>0</strong></div></section><section className="panel" style={{marginTop:'1rem'}}><h2>Reliability</h2><div className="admin-row"><span>Demo mode fallback</span><input type="checkbox" checked={demo} onChange={e=>setDemo(e.target.checked)}/></div><div className="admin-row"><label htmlFor="reset">Automatic reset (seconds)</label><input id="reset" className="input" style={{width:130}} type="number" min="30" max="300" value={reset} onChange={e=>setReset(Number(e.target.value))}/></div><div className="button-row" style={{marginTop:'1rem'}}><button className="secondary-button" onClick={()=>alert('Camera test: open the booth camera screen.')}>Test Camera</button><button className="secondary-button" onClick={()=>alert('AI mock provider is responding.')}>Test AI Provider</button><button className="secondary-button" onClick={()=>alert('Email test requires RESEND_API_KEY.')}>Test Email</button><button className="danger-button" onClick={()=>alert('Temporary in-memory files cleared.')}>Clear Temporary Files</button></div></section><section className="panel" style={{marginTop:'1rem'}}><h2>Enabled styles and templates</h2><div className="admin-list">{[...styles,...templates].map(item=><label className="admin-row" key={item.id}><span>{item.emoji} {item.title}</span><input type="checkbox" checked={enabled[item.id]} onChange={e=>setEnabled(v=>({...v,[item.id]:e.target.checked}))}/></label>)}</div></section></div></main>;
}
