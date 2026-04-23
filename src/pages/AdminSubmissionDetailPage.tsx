import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ForgeButton, ForgeCard, ForgeInlineMessage } from '@tylertech/forge-react'
import { isCurrentUserAdmin } from '../lib/authz'
import { supabase } from '../lib/supabaseClient'
import type { IntakeSubmissionRow } from '../types'

type DetailItemProps = {
  label: string
  value: string
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="submission-detail-item">
      <p className="forge-typography--label1">{label}</p>
      <p className="forge-typography--body2">{value || 'Not provided'}</p>
    </div>
  )
}

function toDisplayList(value: unknown): string {
  if (!Array.isArray(value)) return 'Not provided'
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return items.length ? items.join(', ') : 'Not provided'
}

function toDisplayDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function toDisplayDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleDateString()
  }
  if (typeof value !== 'string' || !value.trim()) return 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [submission, setSubmission] = useState<IntakeSubmissionRow | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    async function guardAndLoad() {
      const isAdmin = await isCurrentUserAdmin()
      setIsAuthorized(isAdmin)

      if (!isAdmin) {
        navigate('/admin/login')
        return
      }

      if (!id) {
        setErrorMessage('Submission ID is missing.')
        return
      }

      const { data, error } = await supabase
        .from('intake_submissions')
        .select('id, submitted_email, payload, status, created_at')
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage(`Unable to load this submission. ${error?.message ?? ''}`.trim())
        return
      }

      const payload = data.payload ?? {}
      setSubmission({
        id: data.id,
        submitted_email: data.submitted_email ?? '',
        payload: data.payload,
        full_name: typeof payload.full_name === 'string' ? payload.full_name : 'Not provided',
        email: typeof payload.email === 'string' ? payload.email : data.submitted_email ?? 'Not provided',
        organization: typeof payload.organization === 'string' ? payload.organization : null,
        details: typeof payload.details === 'string' ? payload.details : '',
        status: data.status ?? 'new',
        created_at: data.created_at,
      })
    }

    void guardAndLoad()
  }, [id, navigate])

  if (isAuthorized === null) {
    return <ForgeInlineMessage theme="info">Loading submission...</ForgeInlineMessage>
  }

  if (errorMessage) {
    return <ForgeInlineMessage theme="error">{errorMessage}</ForgeInlineMessage>
  }

  if (!submission) {
    return <ForgeInlineMessage theme="info">No submission found.</ForgeInlineMessage>
  }

  const payload = submission.payload ?? {}
  const requesterName = typeof payload.requesterName === 'string' ? payload.requesterName : submission.full_name
  const requesterEmail = typeof payload.requesterEmail === 'string' ? payload.requesterEmail : submission.email
  const application = typeof payload.application === 'string' ? payload.application : submission.organization ?? ''
  const moduleName = typeof payload.moduleName === 'string' ? payload.moduleName : ''
  const problemUserPersona = typeof payload.problemUserPersona === 'string' ? payload.problemUserPersona : ''
  const problemTask = typeof payload.problemTask === 'string' ? payload.problemTask : ''
  const problemPainPoint = typeof payload.problemPainPoint === 'string' ? payload.problemPainPoint : ''
  const problemNegativeOutcome =
    typeof payload.problemNegativeOutcome === 'string' ? payload.problemNegativeOutcome : ''
  const problemStatement = typeof payload.problemStatement === 'string' ? payload.problemStatement : submission.details
  const deadlineValue =
    payload.deadline ?? (typeof payload.deadlineDate === 'string' ? payload.deadlineDate : null)

  return (
    <div className="submission-detail-page">
      <div className="form-actions">
        <ForgeButton variant="text" onClick={() => navigate('/admin')}>
          Back to Dashboard
        </ForgeButton>
        <Link to="/" className="link-inline">
          View Public Form
        </Link>
      </div>
      <ForgeCard>
        <section className="page-section">
          <h1 className="forge-typography--heading4">Submission Summary</h1>
          <p className="forge-typography--body2">Review the full details captured from this intake request.</p>
        </section>
        <div className="submission-detail-grid">
          <DetailItem label="Date/Time" value={toDisplayDateTime(submission.created_at)} />
          <DetailItem label="Requester (name)" value={requesterName} />
          <DetailItem label="Requester email" value={requesterEmail} />
          <DetailItem label="Application" value={application} />
          <DetailItem label="Model or feature" value={moduleName} />
          <DetailItem label="Deadline date" value={toDisplayDate(deadlineValue)} />
          <DetailItem label="Primary user/persona" value={problemUserPersona} />
          <DetailItem label="Task to complete" value={problemTask} />
          <DetailItem label="Pain point" value={problemPainPoint} />
          <DetailItem label="Negative outcome" value={problemNegativeOutcome} />
          <DetailItem label="Problem statement" value={problemStatement} />
          <DetailItem label="Assumptions" value={toDisplayList(payload.assumptions)} />
          <DetailItem label="Open questions" value={toDisplayList(payload.questions)} />
          <DetailItem label="Supporting links" value={toDisplayList(payload.supportingLinks)} />
          <DetailItem label="Selected files" value={toDisplayList(payload.selectedFiles)} />
        </div>
      </ForgeCard>
    </div>
  )
}
