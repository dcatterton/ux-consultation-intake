import type { SubmissionAttachment } from './lib/attachments'

export type IntakeSubmissionInsert = {
  submitted_email: string
  payload: Record<string, unknown> & {
    full_name: string
    email: string
    organization: string | null
    details: string
    attachments?: SubmissionAttachment[]
    selectedFiles?: string[]
  }
  status: string
}

export type IntakeSubmissionRow = {
  id: string
  submitted_email: string
  payload: {
    full_name?: string
    email?: string
    organization?: string | null
    details?: string
    requesterName?: string
    requesterEmail?: string
    application?: string
    moduleName?: string
    deadline?: string | null
    deadlineDate?: string | null
    problemUserPersona?: string
    problemTask?: string
    problemPainPoint?: string
    problemNegativeOutcome?: string
    problemStatement?: string | null
    assumptions?: string[]
    questions?: string[]
    supportingLinks?: string[]
    selectedFiles?: string[]
    attachments?: SubmissionAttachment[]
  } | null
  full_name: string
  email: string
  organization: string | null
  details: string
  status: string
  created_at: string
}
