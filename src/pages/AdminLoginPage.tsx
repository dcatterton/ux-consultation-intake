import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ForgeButton, ForgeCard, ForgeInlineMessage, ForgeTextField } from '@tylertech/forge-react'
import { supabase } from '../lib/supabaseClient'
import { isCurrentUserAdmin } from '../lib/authz'

export function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setErrorMessage(error.message)
      setIsSubmitting(false)
      return
    }

    const isAdmin = await isCurrentUserAdmin()
    setIsSubmitting(false)

    if (!isAdmin) {
      await supabase.auth.signOut()
      setErrorMessage('Your account is valid, but it is not allowed to access this admin dashboard.')
      return
    }

    navigate('/admin')
  }

  return (
    <ForgeCard>
      <section className="page-section">
        <h1 className="forge-typography--heading4">Admin Login</h1>
        <p className="forge-typography--body1">Sign in with an allowlisted email address.</p>
      </section>
      <form className="form-grid" onSubmit={handleSubmit}>
        <ForgeTextField label-position="block-start">
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </ForgeTextField>
        <ForgeTextField label-position="block-start">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </ForgeTextField>
        <div className="form-actions">
          <ForgeButton type="submit" variant="filled" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </ForgeButton>
          <Link to="/" className="link-inline">
            Back to form
          </Link>
        </div>
      </form>
      {errorMessage && <ForgeInlineMessage theme="error">{errorMessage}</ForgeInlineMessage>}
    </ForgeCard>
  )
}
