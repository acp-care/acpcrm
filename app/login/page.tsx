'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const supabase = createClient()
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)
    if (mode === 'signup') return setMessage('Account created. Check your email if confirmation is enabled, then sign in.')
    window.location.href = '/'
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="eyebrow">ACP CRM</div><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
    <p className="muted">Secure access to your configurable CRM.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {message && <div className="notice">{message}</div>}
      <button className="btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
    </form>
    <button className="link-button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
      {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
    </button>
  </section></main>
}
