'use client'

import { useEffect, useState } from 'react'

type Condition = { field_key: string; operator: string; value: string }
type Action = { action_type: string; config: Record<string, unknown> }
const operators = ['equals','not_equals','contains','is_empty','not_empty']
const actionTypes = ['update_customer','create_task','create_activity']

export default function AutomationsPage() {
  const [rules, setRules] = useState<any[]>([]), [actions, setActions] = useState<any[]>([]), [fields, setFields] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null), [message, setMessage] = useState('')
  async function load() { const [a,m]=await Promise.all([fetch('/api/automations',{cache:'no-store'}),fetch('/api/mappings',{cache:'no-store'})]); if(a.status===401)return window.location.href='/login'; const ad=await a.json(),md=await m.json(); if(!a.ok)return setMessage(ad.error||'Unable to load automations'); setRules(ad.rules||[]);setActions(ad.actions||[]);setFields(md.fields||[]) }
  useEffect(()=>{load()},[])
  function newRule(){setEditing({name:'New automation',trigger_type:'form_submitted',enabled:true,conditions:[{field_key:'',operator:'equals',value:''}],actions:[{action_type:'create_task',config:{title:'Follow up'}}]})}
  function ruleActions(id:string){return actions.filter(a=>a.automation_rule_id===id).map(a=>({action_type:a.action_type,config:a.config||{}}))}
  function set(p:string,v:unknown){setEditing({...editing,[p]:v})}
  function condition(i:number,p:Partial<Condition>){const c=[...editing.conditions];c[i]={...c[i],...p};set('conditions',c)}
  function action(i:number,p:Partial<Action>){const a=[...editing.actions];a[i]={...a[i],...p};set('actions',a)}
  async function save(){const r=await fetch('/api/automations',{method:editing.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing)});const d=await r.json();if(!r.ok)return setMessage(d.error||'Save failed');setEditing(null);setMessage('Automation saved.');await load()}
  async function toggle(r:any){await fetch('/api/automations',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,enabled:!r.enabled})});await load()}
  async function remove(id:string){if(!confirm('Delete this automation?'))return;await fetch(`/api/automations?id=${id}`,{method:'DELETE'});await load()}
  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a href="/">Dashboard</a><a href="/customers">Customers</a><a href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a className="active" href="/admin/automations">Automations</a></nav></aside><main className="main">
    <div className="top"><div><div className="eyebrow">Admin</div><h1 className="title">Automations</h1><p className="muted">Turn form submissions into repeatable CRM workflows.</p></div><button className="btn" onClick={newRule}>＋ New automation</button></div>
    {editing&&<section className="card section"><div className="section-head"><h2>{editing.id?'Edit automation':'New automation'}</h2><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button></div><div className="form-stack">
      <label>Name<input value={editing.name} onChange={e=>set('name',e.target.value)}/></label><label>Trigger<select value={editing.trigger_type} onChange={e=>set('trigger_type',e.target.value)}><option value="form_submitted">Form submitted</option><option value="customer_created">Customer created</option></select></label>
      <div><h3>Conditions</h3>{editing.conditions.map((c:Condition,i:number)=><div className="mapping-grid" key={i}><select value={c.field_key} onChange={e=>condition(i,{field_key:e.target.value})}><option value="">Any field</option>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select><select value={c.operator} onChange={e=>condition(i,{operator:e.target.value})}>{operators.map(o=><option key={o}>{o}</option>)}</select><input value={c.value} disabled={c.operator==='is_empty'||c.operator==='not_empty'} placeholder="Value" onChange={e=>condition(i,{value:e.target.value})}/></div>)}<button className="btn secondary" onClick={()=>set('conditions',[...editing.conditions,{field_key:'',operator:'equals',value:''}])}>＋ Condition</button></div>
      <div><h3>Actions</h3>{editing.actions.map((a:Action,i:number)=><div className="mapping-grid" key={i}><select value={a.action_type} onChange={e=>action(i,{action_type:e.target.value})}>{actionTypes.map(t=><option key={t}>{t}</option>)}</select>{a.action_type==='update_customer'?<><select value={String(a.config.field||'')} onChange={e=>action(i,{config:{...a.config,field:e.target.value}})}><option value="">Customer field</option>{fields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select><input value={String(a.config.value||'')} placeholder="Value" onChange={e=>action(i,{config:{...a.config,value:e.target.value}})}/></>:<input value={String(a.config.title||'')} placeholder={a.action_type==='create_task'?'Task title':'Activity title'} onChange={e=>action(i,{config:{...a.config,title:e.target.value}})}/>}</div>)}<button className="btn secondary" onClick={()=>set('actions',[...editing.actions,{action_type:'create_task',config:{title:'New task'}}])}>＋ Action</button></div>
      <label className="check"><input type="checkbox" checked={editing.enabled} onChange={e=>set('enabled',e.target.checked)}/> Enabled</label><button className="btn" onClick={save}>Save automation</button></div></section>}
    <section className="card section"><h2>Workflow library</h2>{rules.length===0?<p className="muted">No automations yet. Create your first workflow above.</p>:<div className="list">{rules.map(r=><div className="row" key={r.id}><span><strong>{r.name}</strong><small>{r.trigger_type} · {ruleActions(r.id).length} action(s)</small></span><span className="toolbar-actions"><button className="btn secondary" onClick={()=>setEditing({...r,actions:ruleActions(r.id)})}>Edit</button><button className="btn secondary" onClick={()=>toggle(r)}>{r.enabled?'Disable':'Enable'}</button><button className="btn danger" onClick={()=>remove(r.id)}>Delete</button></span></div>)}</div>}</section>{message&&<div className="notice">{message}</div>}
  </main></div>
}
