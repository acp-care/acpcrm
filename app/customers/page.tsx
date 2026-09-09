'use client'

import { useEffect, useState } from 'react'

type Customer = {
  id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  date_of_birth?: string
  external_ref?: string
  status?: string
  metadata?: Record<string, unknown>
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fields, setFields] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [message, setMessage] = useState('')

  async function load() {
    const r = await fetch(`/api/customers?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
    const d = await r.json()
    if (r.status === 401) return (window.location.href = '/login')
    if (!r.ok) return setMessage(d.error || 'Unable to load customers.')
    setCustomers(d.customers || [])
    setFields(d.fields || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [q])

  async function save() {
    if (!editing) return
    const r = await fetch('/api/customers', {
      method: editing.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    })
    const d = await r.json()
    if (!r.ok) return setMessage(d.error || 'Unable to save customer.')
    setEditing(null)
    setMessage('Customer saved.')
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this customer?')) return
    const r = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      return setMessage(d.error || 'Unable to delete customer.')
    }
    load()
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">ACP CRM</div>
        <nav className="nav">
          <a href="/">Dashboard</a>
          <a className="active" href="/customers">Customers</a>
          <a href="/admin/forms">Forms</a>
          <a href="/admin/mappings">Mappings</a>
          <a href="/admin/automations">Automations</a>
          <a href="/admin/roles">Team &amp; Roles</a>
        </nav>
      </aside>

      <main className="main">
        <div className="top">
          <div>
            <div className="eyebrow">CRM</div>
            <h1 className="title">Customers</h1>
            <p className="muted">One customer record, with configurable fields and automation history.</p>
          </div>
          <button
            className="btn"
            onClick={() => setEditing({ first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', external_ref: '', status: 'active', metadata: {} })}
          >
            ＋ New customer
          </button>
        </div>

        <section className="card">
          <input placeholder="Search name, email, phone or reference…" value={q} onChange={e => setQ(e.target.value)} />
        </section>

        {editing && (
          <section className="card section">
            <div className="section-head">
              <h2>{editing.id ? 'Edit customer' : 'New customer'}</h2>
              <button className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
            <div className="mapping-grid">
              <label>First name<input value={editing.first_name || ''} onChange={e => setEditing({ ...editing, first_name: e.target.value })} /></label>
              <label>Last name<input value={editing.last_name || ''} onChange={e => setEditing({ ...editing, last_name: e.target.value })} /></label>
              <label>Email<input value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} /></label>
              <label>Phone<input value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} /></label>
              <label>Date of birth<input type="date" value={editing.date_of_birth || ''} onChange={e => setEditing({ ...editing, date_of_birth: e.target.value })} /></label>
              <label>External reference<input value={editing.external_ref || ''} onChange={e => setEditing({ ...editing, external_ref: e.target.value })} /></label>
            </div>
            <button className="btn" onClick={save}>Save customer</button>
          </section>
        )}

        <section className="card section">
          <h2>Customer records</h2>
          {customers.length === 0 ? (
            <p className="muted">No customers found.</p>
          ) : (
            <div className="list">
              {customers.map(c => (
                <div className="row" key={c.id}>
                  <span>
                    <strong>{[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed customer'}</strong>
                    <small>{c.email || c.phone || c.external_ref || 'No contact details'} · {c.status}</small>
                  </span>
                  <span className="toolbar-actions">
                    <button className="btn secondary" onClick={() => setEditing(c)}>Edit</button>
                    <button className="btn danger" onClick={() => c.id && remove(c.id)}>Delete</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {fields.length > 0 && (
          <section className="card section">
            <h2>Custom customer fields</h2>
            <p className="muted">{fields.length} active configurable field(s) are available for mappings and automation.</p>
          </section>
        )}

        {message && <div className="notice">{message}</div>}
      </main>
    </div>
  )
}
