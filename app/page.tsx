'use client'

import { useEffect, useState } from 'react'

const modules = [
  ['Customers','Manage client records, contacts and custom data.','/customers'],
  ['Forms','Build completely configurable forms and publish versions.','/admin/forms'],
  ['Mappings','Map submitted form fields to customer data.','/admin/mappings'],
  ['Automations','Trigger actions from form submissions and changes.','/admin/automations'],
  ['Team & Roles','Create custom roles, permissions and staff assignments.','/admin/roles'],
]

export default function Home() {
  const [setup, setSetup] = useState<'checking'|'ready'|'creating'|'error'>('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function initialise() {
      const check = await fetch('/api/setup', { cache: 'no-store' })
      if (check.status === 401) return window.location.href = '/login'
      if (!check.ok) { setSetup('error'); setMessage('Unable to check your CRM setup.'); return }
      const current = await check.json()
      if (current.initialized) return setSetup('ready')

      setSetup('creating')
      const created = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'ACP CRM' }) })
      const data = await created.json().catch(() => ({}))
      if (!created.ok) { setSetup('error'); setMessage(data.error || 'Unable to initialise your organisation.'); return }
      setSetup('ready')
    }
    initialise()
  }, [])

  if (setup !== 'ready') return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">ACP CRM</div><h1>{setup === 'error' ? 'Setup needs attention' : 'Setting up your CRM…'}</h1><p className="muted">{setup === 'creating' ? 'Creating your organisation and Owner role.' : setup === 'checking' ? 'Checking your account.' : message}</p>{setup === 'error' && <a className="btn full" href="/login">Back to sign in</a>}</section></main>

  return <div className="shell"><aside className="sidebar"><div className="brand">ACP CRM</div><nav className="nav"><a className="active" href="/">Dashboard</a><a href="/customers">Customers</a><a href="/admin/forms">Forms</a><a href="/admin/mappings">Mappings</a><a href="/admin/automations">Automations</a><a href="/admin/roles">Team & Roles</a><a href="/tasks">Tasks</a></nav></aside><main className="main"><div className="top"><div><div className="eyebrow">Administration</div><h1 className="title">CRM Dashboard</h1><div className="muted">A configurable foundation for ACP workflows.</div></div><a className="btn" href="/admin/forms">Create form</a></div><div className="grid"><div className="card"><div className="muted">Customers</div><div className="stat">0</div></div><div className="card"><div className="muted">Forms</div><div className="stat">0</div></div><div className="card"><div className="muted">Submissions</div><div className="stat">0</div></div><div className="card"><div className="muted">Open tasks</div><div className="stat">0</div></div></div><section className="section"><h2>CRM modules</h2><div className="list">{modules.map(([name,description,url])=><div className="row" key={name}><div><strong>{name}</strong><div className="muted">{description}</div></div><a className="btn secondary" href={url}>Open</a></div>)}</div></section></main></div>
}
