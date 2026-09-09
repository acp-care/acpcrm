'use client'

import { useEffect, useMemo, useState } from 'react'

type Field = { id?: string; field_key: string; label: string; field_type: string; required: boolean; config: Record<string, unknown>; visibility_rule?: Record<string, unknown> }
const TYPES = ['text','long_text','number','date','email','phone','select','multi_select','radio','checkbox','file','signature']

function slug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || `field_${Date.now()}` }

export default function FormBuilder({ formId }: { formId: string }) {
  const [form, setForm] = useState<any>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [selected, setSelected] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    const res = await fetch(`/api/forms/${formId}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) return setMessage(data.error || 'Unable to load form')
    setForm(data.form); setFields(data.fields || [])
  }
  useEffect(() => { load() }, [formId])

  const current = fields[selected]
  const options = useMemo(() => Array.isArray(current?.config?.options) ? current.config.options as string[] : [], [current])

  function addField(type = 'text') {
    const next: Field = { field_key: `field_${fields.length + 1}`, label: 'New field', field_type: type, required: false, config: type === 'select' || type === 'multi_select' || type === 'radio' ? { options: ['Option 1','Option 2'] } : {} }
    setFields([...fields, next]); setSelected(fields.length)
  }
  function update(patch: Partial<Field>) { setFields(fields.map((f,i) => i === selected ? { ...f, ...patch } : f)) }
  function move(delta: number) { const target = selected + delta; if (target < 0 || target >= fields.length) return; const copy=[...fields]; [copy[selected],copy[target]]=[copy[target],copy[selected]]; setFields(copy); setSelected(target) }
  function remove() { setFields(fields.filter((_,i)=>i!==selected)); setSelected(Math.max(0, selected-1)) }

  async function save(action = 'save_fields') {
    setSaving(true); setMessage('')
    const res = await fetch(`/api/forms/${formId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(action === 'publish' ? {action:'publish'} : {action, fields}) })
    const data = await res.json(); setSaving(false)
    setMessage(res.ok ? (action === 'publish' ? 'Published successfully.' : 'Saved.') : (data.error || 'Save failed'))
    if (res.ok && action === 'publish') await load()
  }
  async function saveDetails() {
    setSaving(true); const res=await fetch(`/api/forms/${formId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',name:form.name,description:form.description})}); const data=await res.json(); setSaving(false); setMessage(res.ok?'Form details saved.':(data.error||'Save failed')); if(res.ok) await load()
  }

  if (!form) return <div className="card">{message || 'Loading form…'}</div>
  return <div className="builder">
    <div className="builder-toolbar">
      <div><input className="builder-title" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><div className="muted">Version {form.current_version_id ? 'draft' : '1'} · {form.status}</div></div>
      <div className="toolbar-actions"><button className="btn secondary" onClick={saveDetails} disabled={saving}>Save details</button><button className="btn secondary" onClick={()=>save()} disabled={saving}>Save fields</button><button className="btn" onClick={()=>save('publish')} disabled={saving}>Publish</button></div>
    </div>
    <div className="builder-layout">
      <aside className="field-palette card"><h3>Add field</h3>{TYPES.map(t=><button key={t} className="palette-item" onClick={()=>addField(t)}>＋ {t.replace('_',' ')}</button>)}</aside>
      <section className="card canvas"><div className="section-head"><div><h2>Form canvas</h2><p className="muted">Drag-free reordering with ↑ ↓. Published versions remain immutable.</p></div><button className="btn secondary" onClick={()=>addField()}>＋ Custom field</button></div>
        {fields.length===0 ? <div className="empty">No fields yet. Add one from the field palette.</div> : <div className="field-list">{fields.map((f,i)=><button key={f.field_key} className={`field-card ${i===selected?'selected':''}`} onClick={()=>setSelected(i)}><span className="field-index">{i+1}</span><span><strong>{f.label || 'Untitled field'}</strong><small>{f.field_type}{f.required?' · required':''}</small></span></button>)}</div>}
      </section>
      <aside className="card inspector"><h3>Field settings</h3>{current ? <div className="form-stack">
        <label>Label<input value={current.label} onChange={e=>update({label:e.target.value,field_key:slug(e.target.value)})}/></label>
        <label>Field key<input value={current.field_key} onChange={e=>update({field_key:slug(e.target.value)})}/></label>
        <label>Type<select value={current.field_type} onChange={e=>update({field_type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={current.required} onChange={e=>update({required:e.target.checked})}/> Required</label>
        {(current.field_type==='select'||current.field_type==='multi_select'||current.field_type==='radio') && <label>Options<textarea value={options.join('\n')} onChange={e=>update({config:{...current.config,options:e.target.value.split('\n').filter(Boolean)}})}/></label>}
        <div className="inspector-actions"><button className="btn secondary" onClick={()=>move(-1)}>↑</button><button className="btn secondary" onClick={()=>move(1)}>↓</button><button className="btn danger" onClick={remove}>Delete</button></div>
      </div> : <p className="muted">Select a field to edit it.</p>}</aside>
    </div>
    {message && <div className="notice">{message}</div>}
  </div>
}
