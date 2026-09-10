'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error')
    if (error) setMessage(error.replaceAll('_', ' '))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    setBusy(true)
    setMessage('')

    try {
      const supabase = createClient()
      const origin = window.location.origin
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${origin}/auth/callback`,
            },
          })

      if (result.error) {
        setMessage(result.error.message)
        return
      }

      if (mode === 'signup') {
        if (result.data.session) {
          window.location.href = '/'
          return
        }
        setMessage('Account created. Check your email and click the confirmation link to finish setting up your CRM.')
        return
      }

      window.location.href = '/'
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect to the authentication service.')
    } finally {
      setBusy(false)
    }
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
    <button className="link-button" onClick={() => { setMessage(''); setMode(mode === 'login' ? 'signup' : 'login') }}>
      {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
    </button>
  </section></main>
}
