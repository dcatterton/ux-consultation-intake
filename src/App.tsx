import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ForgeAppBar, ForgeButton, ForgeIcon, ForgeInlineMessage } from '@tylertech/forge-react'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminSubmissionDetailPage } from './pages/AdminSubmissionDetailPage'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
import { IntakeFormPage } from './pages/IntakeFormPage'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const contentClassName = location.pathname.startsWith('/admin') ? 'app-content app-content-admin' : 'app-content'

  useEffect(() => {
    if (!hasSupabaseConfig) return

    let isMounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setIsAuthenticated(Boolean(data.session))
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session))
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleAppBarAuthAction() {
    if (!hasSupabaseConfig) return

    if (isAuthenticated) {
      await supabase.auth.signOut()
      navigate('/')
      return
    }

    navigate('/admin/login')
  }

  return (
    <div className="app-shell">
      <ForgeAppBar theme-mode="white" title-text="UX Consultation Intake">
        <ForgeIcon slot="logo" name="tyler_talking_t_logo"></ForgeIcon>
        <ForgeButton slot="end" variant="outlined" onClick={handleAppBarAuthAction}>
          <ForgeIcon slot="start" name={isAuthenticated ? 'logout' : 'login'} external></ForgeIcon>
          {isAuthenticated ? 'Sign out' : 'Sign in'}
        </ForgeButton>
      </ForgeAppBar>
      <main className={contentClassName}>
        {!hasSupabaseConfig ? (
          <ForgeInlineMessage theme="error">
            Missing Supabase configuration. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a `.env` file,
            then restart the dev server.
          </ForgeInlineMessage>
        ) : (
          <Routes>
            <Route path="/" element={<IntakeFormPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/submissions/:id" element={<AdminSubmissionDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  )
}

export default App
