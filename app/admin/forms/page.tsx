'use client'

import { useEffect, useState } from 'react'

export default function FormsPage(){
  const [forms,setForms]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  useEffect(()=>{fetch('/api/forms',{cache:'no-store'}).then(async r=>{const d=await r.json();if(r.status===401)return window.location.href='/login';if(!r.ok)throw new Error(d.error);setForms(d.forms||[])}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a className="active" href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a href="/admin/automations">Automations</a></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">Admin</div><h1 className="title">Form Builder</h1><div className="muted">Every form is configurable metadata — no hardcoded questionnaires.</div></div><a className="btn" href="/admin/forms/new">New form</a></div>{error&&<div className="notice error">{error}</div>}{loading?<div className="card">Loading forms…</div>:forms.length===0?<div className="card"><h2>No forms yet</h2><p className="muted">Create your first form. Add fields, reorder them, set validation and publish versioned forms.</p><a className="btn" href="/admin/forms/new">Create your first form</a></div>:<div className="list card">{forms.map(f=><a className="row form-row" key={f.id} href={`/admin/forms/${f.id}`}><span><strong>{f.name}</strong><small>{f.description||'No description'}</small></span><span className="badge">{f.status}</span></a>)}</div>}</main></div>
}
