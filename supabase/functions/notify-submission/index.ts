import { createClient } from 'npm:@supabase/supabase-js@2'

type NotifyPayload = {
  submissionId?: string
  submission?: {
    submitted_email?: string
    payload?: Record<string, unknown>
    status?: string
    created_at?: string
  }
}

type SubmissionRow = {
  id: string
  full_name?: string | null
  email?: string | null
  organization?: string | null
  details?: string | null
  submitted_email?: string | null
  payload?: Record<string, unknown> | null
  status?: string | null
  created_at?: string | null
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const { submissionId, submission: inlineSubmission } = (await request.json()) as NotifyPayload

  if (!submissionId && !inlineSubmission) {
    return new Response('Missing submission payload', { status: 400, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') ?? 'no-reply@example.com'

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response('Missing function environment variables', { status: 500, headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let submission: SubmissionRow | null = null

  if (submissionId) {
    const { data: dbSubmission, error: submissionError } = await supabase
      .from('intake_submissions')
      .select('*')
      .eq('id', submissionId)
      .single<SubmissionRow>()

    if (!submissionError && dbSubmission) {
      submission = dbSubmission
    }
  }

  const { data: recipients, error: recipientError } = await supabase
    .from('notification_recipients')
    .select('email')

  if (recipientError || !recipients?.length) {
    return new Response('No recipients configured', { status: 400, headers: corsHeaders })
  }

  const toEmails = recipients.map((recipient) => recipient.email)
  const payload = submission?.payload ?? inlineSubmission?.payload ?? {}
  const fullName = getString(submission?.full_name) ?? getString(payload.full_name) ?? 'Not provided'
  const email =
    getString(submission?.email) ??
    getString(submission?.submitted_email) ??
    getString(inlineSubmission?.submitted_email) ??
    getString(payload.email) ??
    'Not provided'
  const organization = getString(submission?.organization) ?? getString(payload.organization) ?? 'Not provided'
  const details = getString(submission?.details) ?? getString(payload.details) ?? 'Not provided'
  const status = getString(submission?.status) ?? getString(inlineSubmission?.status) ?? 'new'
  const createdAt = getString(submission?.created_at) ?? getString(inlineSubmission?.created_at) ?? 'Not provided'

  const messageHtml = `
    <h2>New UX consultation intake submission</h2>
    <p><strong>Submitted:</strong> ${createdAt}</p>
    <p><strong>Name:</strong> ${fullName}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Organization:</strong> ${organization}</p>
    <p><strong>Status:</strong> ${status}</p>
    <p><strong>Details:</strong></p>
    <p>${details}</p>
  `

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmails,
      subject: 'New UX Intake Submission',
      html: messageHtml,
    }),
  })

  if (!emailResponse.ok) {
    const text = await emailResponse.text()
    return new Response(`Failed sending email: ${text}`, { status: 500, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
