'use client'

import { FormEvent, useState } from 'react'

export default function NewFormPage(){
  const [name,setName]=useState(''); const [description,setDescription]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('')
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');const r=await fetch('/api/forms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description})});const d=await r.json();setBusy(false);if(!r.ok)return setError(d.error||'Could not create form');window.location.href=`/admin/forms/${d.id}`}
  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a className="active" href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a href="/admin/automations">Automations</a></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">Admin · Forms</div><h1 className="title">Create form</h1><p className="muted">Start with metadata. Fields and rules can be changed later.</p></div></div><section className="card narrow"><form className="form-stack" onSubmit={submit}><label>Form name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Initial Assessment"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What this form is used for"/></label>{error&&<div className="notice error">{error}</div>}<div className="toolbar-actions"><a className="btn secondary" href="/admin/forms">Cancel</a><button className="btn" disabled={busy}>{busy?'Creating…':'Create form'}</button></div></form></section></main></div>
}
