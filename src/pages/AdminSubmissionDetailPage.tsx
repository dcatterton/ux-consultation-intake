import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ForgeButton,
  ForgeCard,
  ForgeDivider,
  ForgeInlineMessage,
  ForgeLabelValue,
} from '@tylertech/forge-react'
import { isCurrentUserAdmin } from '../lib/authz'
import { supabase } from '../lib/supabaseClient'
import type { IntakeSubmissionRow } from '../types'

type DetailSectionProps = {
  title: string
  description: string
  children: ReactNode
}

type DetailFieldProps = {
  label: string
  value: string
}

type DetailListFieldProps = {
  label: string
  values: unknown
}

function DetailSection({ title, description, children }: DetailSectionProps) {
  return (
    <section className="submission-detail-section">
      <h2 className="forge-typography--subheading2">{title}</h2>
      <p className="forge-typography--body2 submission-detail-section-description">{description}</p>
      <div className="submission-detail-fields">{children}</div>
    </section>
  )
}

function DetailField({ label, value }: DetailFieldProps) {
  return (
    <ForgeLabelValue>
      <span slot="label">{label}</span>
      <span slot="value">{value || 'Not provided'}</span>
    </ForgeLabelValue>
  )
}

function toDisplayList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function DetailListField({ label, values }: DetailListFieldProps) {
  const items = toDisplayList(values)

  return (
    <ForgeLabelValue>
      <span slot="label">{label}</span>
      {items.length ? (
        <ul slot="value" className="submission-detail-list">
          {items.map((item) => (
            <li key={item} className="forge-typography--body2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <span slot="value">Not provided</span>
      )}
    </ForgeLabelValue>
  )
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
      <ForgeCard raised>
        <section className="page-section">
          <h1 className="forge-typography--heading4">Submission Summary</h1>
          <p className="forge-typography--body2">
            Review the full details captured from this intake request.
          </p>
        </section>

        <ForgeDivider></ForgeDivider>

        <DetailSection
          title="Request details"
          description="Contact information, application context, and timing for this request."
        >
          <DetailField label="Date/Time" value={toDisplayDateTime(submission.created_at)} />
          <DetailField label="Requester (name)" value={requesterName} />
          <DetailField label="Requester email" value={requesterEmail} />
          <DetailField label="Application" value={application} />
          <DetailField label="Module or feature" value={moduleName} />
          <DetailField label="Deadline date" value={toDisplayDate(deadlineValue)} />
        </DetailSection>

        <ForgeDivider></ForgeDivider>

        <DetailSection
          title="Problem hypothesis"
          description="The user problem being explored, including who is affected and why it matters."
        >
          <DetailField label="Primary user/persona" value={problemUserPersona} />
          <DetailField label="Task to complete" value={problemTask} />
          <DetailField label="Pain point" value={problemPainPoint} />
          <DetailField label="Negative outcome" value={problemNegativeOutcome} />
          <DetailField label="Problem statement" value={problemStatement} />
        </DetailSection>

        <ForgeDivider></ForgeDivider>

        <DetailSection
          title="Assumptions and unknowns"
          description="Beliefs that still need validation and open questions to resolve."
        >
          <DetailListField label="Assumptions" values={payload.assumptions} />
          <DetailListField label="Open questions" values={payload.questions} />
        </DetailSection>

        <ForgeDivider></ForgeDivider>

        <DetailSection
          title="Supporting materials"
          description="Links and files shared to provide additional context."
        >
          <DetailListField label="Supporting links" values={payload.supportingLinks} />
          <DetailListField label="Selected files" values={payload.selectedFiles} />
        </DetailSection>
      </ForgeCard>
    </div>
  )
}
