import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

declare const Deno: {
  env: {
    get: (key: string) => string | undefined
  }
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

type RewriteRequest = {
  problemUserPersona?: unknown
  problemTask?: unknown
  problemPainPoint?: unknown
  problemNegativeOutcome?: unknown
}

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_FIELD_LENGTH = 400

function normalizeInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function boundedInput(value: string): string {
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) : value
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'

  if (!apiKey) {
    return jsonResponse(500, { error: 'Missing OPENAI_API_KEY environment variable.' })
  }

  let payload: RewriteRequest
  try {
    payload = (await request.json()) as RewriteRequest
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' })
  }

  const problemUserPersona = boundedInput(normalizeInput(payload.problemUserPersona))
  const problemTask = boundedInput(normalizeInput(payload.problemTask))
  const problemPainPoint = boundedInput(normalizeInput(payload.problemPainPoint))
  const problemNegativeOutcome = boundedInput(normalizeInput(payload.problemNegativeOutcome))

  if (!problemUserPersona || !problemTask || !problemPainPoint || !problemNegativeOutcome) {
    return jsonResponse(400, { error: 'All four problem statement fields are required.' })
  }

  const systemPrompt = [
    'You are a UX writing assistant that rewrites intake content into a polished UX problem statement.',
    'Output exactly one sentence.',
    'Preserve the original meaning and scope; do not add assumptions.',
    'Use clear grammar and professional wording.',
    'Key rule: Avoid solution language in the "need" clause.',
    'Use this template for the problem statement: The User Needs Statement (Nielsen Norman / UX Canon): [User persona] needs [a way to do/have something] because [underlying motivation or insight].',
    'Do not use bullet points, labels, or markdown.',
  ].join(' ')

  const userPrompt = [
    `Persona: ${problemUserPersona}`,
    `Task: ${problemTask}`,
    `Pain point: ${problemPainPoint}`,
    `Negative outcome: ${problemNegativeOutcome}`,
    '',
    'Rewrite this into one concise UX problem statement sentence.',
    'Use this template for the problem statement: The User Needs Statement (Nielsen Norman / UX Canon): [User persona] needs [a way to do/have something] because [underlying motivation or insight].'
  ].join('\n')

  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text()
    return jsonResponse(502, { error: `AI rewrite failed: ${errorText}` })
  }

  const result = (await aiResponse.json()) as OpenAIResponse
  const rewritten = result.choices?.[0]?.message?.content?.trim()

  if (!rewritten) {
    return jsonResponse(502, { error: 'AI rewrite returned an empty response.' })
  }

  return jsonResponse(200, { rewrittenStatement: rewritten })
})
