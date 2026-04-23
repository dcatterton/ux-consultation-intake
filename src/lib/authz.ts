import { supabase } from './supabaseClient'

export async function isCurrentUserAdmin(): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) return false

  const email = user.email.toLowerCase()

  // Primary authorization model in this Supabase project:
  // `allowed_accounts` with active admin role.
  const { count: allowedCount, error: allowedError } = await supabase
    .from('allowed_accounts')
    .select('email', { count: 'exact', head: true })
    .eq('email', email)
    .eq('is_active', true)
    .eq('role', 'admin')

  if (!allowedError && (allowedCount ?? 0) > 0) {
    return true
  }

  // Back-compat / secondary allowlist used by some deployments.
  const { count: legacyCount, error: legacyError } = await supabase
    .from('admin_allowlist')
    .select('email', { count: 'exact', head: true })
    .eq('email', email)

  if (legacyError) return false
  return (legacyCount ?? 0) > 0
}
