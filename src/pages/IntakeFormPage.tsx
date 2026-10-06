import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ForgeButton,
  ForgeCard,
  ForgeDatePicker,
  ForgeFilePicker,
  ForgeIconButton,
  ForgeIcon,
  ForgeInlineMessage,
  ForgeList,
  ForgeListItem,
  ForgeRadio,
  ForgeRadioGroup,
  ForgeTextField,
} from '@tylertech/forge-react'
import {
  buildAttachmentPath,
  INTAKE_ATTACHMENTS_BUCKET,
  type SubmissionAttachment,
} from '../lib/attachments'
import { supabase } from '../lib/supabaseClient'
import type { IntakeSubmissionInsert } from '../types'

type PickedFile = {
  id: string
  name: string
  legal: boolean
  error?: string
  file?: File
}

type IntakeFormValues = {
  requesterName: string
  requesterEmail: string
  application: string
  moduleName: string
  hasDeadline: '' | 'yes' | 'no'
  deadline: string
  problemUserPersona: string
  problemTask: string
  problemPainPoint: string
  problemNegativeOutcome: string
  assumptions: string[]
  questions: string[]
  supportingLinks: string[]
}

const INITIAL_FORM: IntakeFormValues = {
  requesterName: '',
  requesterEmail: '',
  application: '',
  moduleName: '',
  hasDeadline: '',
  deadline: '',
  problemUserPersona: '',
  problemTask: '',
  problemPainPoint: '',
  problemNegativeOutcome: '',
  assumptions: [''],
  questions: [''],
  supportingLinks: [''],
}

function FieldRepeater({
  label,
  placeholder,
  values,
  onChange,
  onAdd,
  onRemove,
}: {
  label?: string
  placeholder: string
  values: string[]
  onChange: (index: number, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="intake-mt-medium">
      {label ? <h3 className="forge-typography--subheading2">{label}</h3> : null}
      {values.map((value, index) => (
        <div key={`${label}-${index}`} className="intake-mb-medium intake-repeater-row">
          <div className="intake-repeater-field">
            <ForgeTextField label-position="block-start">
              <input
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(index, event.target.value)}
              />
            </ForgeTextField>
          </div>
          {index > 0 ? (
            <ForgeIconButton
              type="button"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <ForgeIcon name="remove_circle" external></ForgeIcon>
            </ForgeIconButton>
          ) : null}
        </div>
      ))}
      <ForgeButton variant="text" type="button" onClick={onAdd}>
        <ForgeIcon slot="start" name="add" external></ForgeIcon>
        Add
      </ForgeButton>
    </div>
  )
}

export function IntakeFormPage() {
  const [formValues, setFormValues] = useState<IntakeFormValues>(INITIAL_FORM)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [aiProblemStatement, setAiProblemStatement] = useState<string>('')
  const [isRewritingProblemStatement, setIsRewritingProblemStatement] = useState(false)
  const [problemStatementRewriteError, setProblemStatementRewriteError] = useState<string>('')
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const filePickerRef = useRef<HTMLElement | null>(null)
  const rewriteDebounceTimeoutRef = useRef<number | null>(null)
  const rewriteRequestIdRef = useRef(0)
  const lastRewriteSignatureRef = useRef('')
  const composedProblemStatement = useMemo(() => {
    if (
      !formValues.problemUserPersona ||
      !formValues.problemTask ||
      !formValues.problemPainPoint ||
      !formValues.problemNegativeOutcome
    ) {
      return ''
    }
    return `${formValues.problemUserPersona} needs a way to ${formValues.problemTask} because ${formValues.problemPainPoint} results in ${formValues.problemNegativeOutcome}.`
  }, [
    formValues.problemUserPersona,
    formValues.problemTask,
    formValues.problemPainPoint,
    formValues.problemNegativeOutcome,
  ])
  const problemStatement = composedProblemStatement ? aiProblemStatement || composedProblemStatement : ''

  function setDeadlineValue(value: string) {
    setFormValues((prev) => ({ ...prev, deadline: value }))
  }

  function setDeadlineFromDatePickerEvent(detail: unknown) {
    if (detail instanceof Date) {
      setDeadlineValue(detail.toLocaleDateString())
      return
    }

    if (typeof detail === 'string') {
      setDeadlineValue(detail)
      return
    }

    if (detail === null) {
      setDeadlineValue('')
    }
  }

  function updateArrayField(key: 'assumptions' | 'questions' | 'supportingLinks', index: number, value: string) {
    setFormValues((prev) => {
      const next = [...prev[key]]
      next[index] = value
      return { ...prev, [key]: next }
    })
  }

  function addArrayItem(key: 'assumptions' | 'questions' | 'supportingLinks') {
    setFormValues((prev) => ({ ...prev, [key]: [...prev[key], ''] }))
  }

  function removeArrayItem(key: 'assumptions' | 'questions' | 'supportingLinks', index: number) {
    setFormValues((prev) => {
      const next = prev[key].filter((_, itemIndex) => itemIndex !== index)
      return { ...prev, [key]: next.length ? next : [''] }
    })
  }

  useEffect(() => {
    const persona = formValues.problemUserPersona.trim()
    const task = formValues.problemTask.trim()
    const painPoint = formValues.problemPainPoint.trim()
    const negativeOutcome = formValues.problemNegativeOutcome.trim()

    if (!persona || !task || !painPoint || !negativeOutcome) {
      return
    }

    const rewriteSignature = [persona, task, painPoint, negativeOutcome].join('|')

    if (rewriteSignature === lastRewriteSignatureRef.current) {
      return
    }

    if (rewriteDebounceTimeoutRef.current) {
      window.clearTimeout(rewriteDebounceTimeoutRef.current)
    }

    rewriteDebounceTimeoutRef.current = window.setTimeout(async () => {
      const requestId = rewriteRequestIdRef.current + 1
      rewriteRequestIdRef.current = requestId
      setAiProblemStatement('')
      setProblemStatementRewriteError('')
      setIsRewritingProblemStatement(true)

      try {
        const { data, error } = await supabase.functions.invoke('rewrite-problem-statement', {
          body: {
            problemUserPersona: persona,
            problemTask: task,
            problemPainPoint: painPoint,
            problemNegativeOutcome: negativeOutcome,
          },
        })

        if (requestId !== rewriteRequestIdRef.current) return

        if (error) {
          setProblemStatementRewriteError('Could not formalize the problem statement right now.')
          setIsRewritingProblemStatement(false)
          return
        }

        const rewrittenStatement =
          data && typeof data === 'object' && 'rewrittenStatement' in data ? data.rewrittenStatement : ''

        if (typeof rewrittenStatement !== 'string' || !rewrittenStatement.trim()) {
          setProblemStatementRewriteError('The rewrite service returned an empty result.')
          setIsRewritingProblemStatement(false)
          return
        }

        setAiProblemStatement(rewrittenStatement.trim())
        lastRewriteSignatureRef.current = rewriteSignature
        setIsRewritingProblemStatement(false)
      } catch {
        setProblemStatementRewriteError('Could not formalize the problem statement right now.')
        setIsRewritingProblemStatement(false)
      }
    }, 700)

    return () => {
      if (rewriteDebounceTimeoutRef.current) {
        window.clearTimeout(rewriteDebounceTimeoutRef.current)
      }
    }
  }, [
    formValues.problemUserPersona,
    formValues.problemTask,
    formValues.problemPainPoint,
    formValues.problemNegativeOutcome,
  ])

  useEffect(() => {
    const picker = filePickerRef.current
    if (!picker) return

    const handleFilePickerChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ legalFiles?: File[]; illegalFiles?: File[] }>
      const legalFiles = customEvent.detail?.legalFiles ?? []
      const illegalFiles = customEvent.detail?.illegalFiles ?? []
      const timestamp = Date.now()
      const nextLegal = legalFiles.map((file, index) => ({
        id: `legal-${timestamp}-${index}`,
        name: file.name,
        legal: true,
        file,
      }))
      const nextIllegal = illegalFiles.map((file, index) => ({
        id: `illegal-${timestamp}-${index}`,
        name: file.name,
        legal: false,
        error: 'File type or size is not allowed.',
      }))

      if (!nextLegal.length && !nextIllegal.length) return
      setPickedFiles((prev) => [...prev, ...nextLegal, ...nextIllegal])
    }

    picker.addEventListener('forge-file-picker-change', handleFilePickerChange)
    return () => {
      picker.removeEventListener('forge-file-picker-change', handleFilePickerChange)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')
    setIsSubmitting(true)

    const normalizedEmail = formValues.requesterEmail.trim().toLowerCase()
    const normalizedName = formValues.requesterName.trim()
    const normalizedApplication = formValues.application.trim()
    const legalFiles = pickedFiles.filter((item) => item.legal && item.file)

    let attachments: SubmissionAttachment[] = []
    if (legalFiles.length) {
      const folderId = crypto.randomUUID()
      const uploaded: SubmissionAttachment[] = []

      for (const item of legalFiles) {
        const file = item.file
        if (!file) continue

        const path = buildAttachmentPath(folderId, file.name)
        const { error: uploadError } = await supabase.storage.from(INTAKE_ATTACHMENTS_BUCKET).upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })

        if (uploadError) {
          setErrorMessage(`We could not upload "${file.name}". ${uploadError.message}`)
          setIsSubmitting(false)
          return
        }

        uploaded.push({
          name: file.name,
          path,
          size: file.size,
          contentType: file.type || undefined,
        })
      }

      attachments = uploaded
    }

    const payload: IntakeSubmissionInsert = {
      submitted_email: normalizedEmail,
      payload: {
        full_name: normalizedName,
        email: normalizedEmail,
        organization: normalizedApplication || null,
        details: problemStatement || `${formValues.problemTask.trim()} - ${formValues.problemPainPoint.trim()}`,
        requesterName: normalizedName,
        requesterEmail: normalizedEmail,
        application: normalizedApplication,
        moduleName: formValues.moduleName.trim(),
        deadline: formValues.hasDeadline === 'yes' ? formValues.deadline || null : null,
        problemUserPersona: formValues.problemUserPersona.trim(),
        problemTask: formValues.problemTask.trim(),
        problemPainPoint: formValues.problemPainPoint.trim(),
        problemNegativeOutcome: formValues.problemNegativeOutcome.trim(),
        problemStatement: problemStatement || null,
        assumptions: formValues.assumptions.map((value) => value.trim()).filter(Boolean),
        questions: formValues.questions.map((value) => value.trim()).filter(Boolean),
        supportingLinks: formValues.supportingLinks.map((value) => value.trim()).filter(Boolean),
        attachments,
        selectedFiles: attachments.map((file) => file.name),
      },
      status: 'new',
    }

    const { error } = await supabase.from('intake_submissions').insert(payload)

    if (error) {
      setErrorMessage(`We could not submit your intake form right now. ${error.message}`)
      setIsSubmitting(false)
      return
    }

    await supabase.functions.invoke('notify-submission', {
      body: { submission: payload },
    })

    setStatusMessage('Thanks! Your intake request has been submitted.')
    setFormValues(INITIAL_FORM)
    setAiProblemStatement('')
    setProblemStatementRewriteError('')
    setIsRewritingProblemStatement(false)
    lastRewriteSignatureRef.current = ''
    setPickedFiles([])
    setIsSubmitting(false)
  }

  function removePickedFile(fileId: string) {
    setPickedFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  return (
    <>
      <section className="page-section">
        <h1 className="forge-typography--heading6">Submit a UX Consultation Request</h1>
        <p className="forge-typography--body3 intake-mb-xlarge">
        This intake helps us align on the problem before design begins by asking a few focused questions. There are no right answers — we're looking for clarity, not perfection.


        </p>
      </section>
      <form className="form-grid" onSubmit={handleSubmit}>
        <ForgeCard raised>
          <section className="question-group">
            <div className="request-details-header-row">
              <div className="request-details-header-content">
                <h1 className="forge-typography--heading4">Request details</h1>
                <p className="forge-typography--body2">
                  Provide details about yourself and the product you support to help us properly contextualize this request.
                </p>
              </div>
              <img
                src="https://cdn.forge.tylertech.com/v1/images/spot/info-1-spot.svg"
                alt=""
                aria-hidden="true"
                className="request-details-header-image"
              />
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="requester-name">What is your name?</label>
                <input
                  id="requester-name"
                  value={formValues.requesterName}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, requesterName: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="requester-email">What is your email?</label>
                <input
                  id="requester-email"
                  type="email"
                  value={formValues.requesterEmail}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, requesterEmail: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start">
                <label htmlFor="application-name">Which application do you support?</label>
                <input
                  id="application-name"
                  value={formValues.application}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, application: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start">
                <label htmlFor="module-name">Which module or feature are you requesting UX support for?</label>
                <input
                  id="module-name"
                  value={formValues.moduleName}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, moduleName: event.target.value }))}
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <p id="deadline-question" className="forge-typography--label2">
                Is there a deadline or time constraint?
              </p>
              <ForgeRadioGroup aria-labelledby="deadline-question">
                <ForgeRadio
                  checked={formValues.hasDeadline === 'yes'}
                  onChange={() => setFormValues((prev) => ({ ...prev, hasDeadline: 'yes' }))}
                >
                  Yes
                </ForgeRadio>
                <ForgeRadio
                  checked={formValues.hasDeadline === 'no'}
                  onChange={() => setFormValues((prev) => ({ ...prev, hasDeadline: 'no', deadline: '' }))}
                >
                  No
                </ForgeRadio>
              </ForgeRadioGroup>
            </div>
            {formValues.hasDeadline === 'yes' ? (
              <div className="intake-mt-medium">
                <ForgeDatePicker
                  {...{
                    'on-forge-date-picker-change': (event: CustomEvent<Date | string | null>) =>
                      setDeadlineFromDatePickerEvent(event.detail),
                    'on-forge-date-picker-input': (event: CustomEvent<string>) =>
                      setDeadlineFromDatePickerEvent(event.detail),
                  }}
                >
                  <ForgeTextField label-position="block-start">
                    <label htmlFor="deadline">What is the deadline?</label>
                    <input
                      id="deadline"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      value={formValues.deadline}
                      onInput={(event) => setDeadlineValue((event.target as HTMLInputElement).value)}
                      onChange={(event) => setDeadlineValue(event.target.value)}
                    />
                  </ForgeTextField>
                </ForgeDatePicker>
              </div>
            ) : null}
          </section>
        </ForgeCard>

        <ForgeCard raised>
          <section className="question-group">
            <div className="request-details-header-row">
              <div className="request-details-header-content">
                <h1 className="forge-typography--heading4">Problem hypothesis</h1>
                <p className="forge-typography--body2">
                  A clear explanation of the user problem we are trying to solve, including who is affected, what is difficult today, and why it matters.
                </p>
              </div>
              <img
                src="https://cdn.forge.tylertech.com/v1/images/spot/error-spot.svg"
                alt=""
                aria-hidden="true"
                className="request-details-header-image"
              />
              
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="problem-user">Who is the primary user or persona?</label>
                <input
                  id="problem-user"
                  value={formValues.problemUserPersona}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, problemUserPersona: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="problem-task">What task do we want them to complete?</label>
                <input
                  id="problem-task"
                  value={formValues.problemTask}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, problemTask: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="problem-pain">What is their current pain point or problem?</label>
                <input
                  id="problem-pain"
                  value={formValues.problemPainPoint}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, problemPainPoint: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <div className="intake-mt-medium">
              <ForgeTextField label-position="block-start" required>
                <label htmlFor="problem-outcome">What negative outcome does this result in?</label>
                <input
                  id="problem-outcome"
                  value={formValues.problemNegativeOutcome}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, problemNegativeOutcome: event.target.value }))}
                  required
                />
              </ForgeTextField>
            </div>
            <ForgeInlineMessage className="intake-mt-medium" theme="info-secondary">
              <ForgeIcon slot="icon" name="auto_awesome" external></ForgeIcon>
              <p>{problemStatement || 'Answer all four questions to generate a problem statement.'}</p>
              {isRewritingProblemStatement && composedProblemStatement ? (
                <p className="problem-statement-status">Formalizing with AI...</p>
              ) : null}
              {problemStatementRewriteError && composedProblemStatement ? (
                <p className="problem-statement-status problem-statement-status-error">{problemStatementRewriteError}</p>
              ) : null}
            </ForgeInlineMessage>
          </section>
        </ForgeCard>

        <ForgeCard raised>
          <section className="question-group">
            <div className="request-details-header-row">
              <div className="request-details-header-content">
                <h1 className="forge-typography--heading4">Assumptions and unknowns</h1>
                <p className="forge-typography--body2">
                  Things we believe to be true but haven't validated yet. This helps us identify risks and determine validation needs before design.
                </p>
              </div>
              <img
                src="https://cdn.forge.tylertech.com/v1/images/spot/ask-question-spot.svg"
                alt=""
                aria-hidden="true"
                className="request-details-header-image"
              />
            </div>
            <FieldRepeater
              label="What assumptions are we making about users, data, or behavior?"
              placeholder="Enter an assumption..."
              values={formValues.assumptions}
              onChange={(index, value) => updateArrayField('assumptions', index, value)}
              onAdd={() => addArrayItem('assumptions')}
              onRemove={(index) => removeArrayItem('assumptions', index)}
            />
            <FieldRepeater
              label="What questions or gaps in understanding still need answers?"
              placeholder="Enter an open question or gap..."
              values={formValues.questions}
              onChange={(index, value) => updateArrayField('questions', index, value)}
              onAdd={() => addArrayItem('questions')}
              onRemove={(index) => removeArrayItem('questions', index)}
            />
          </section>
        </ForgeCard>

        <ForgeCard raised>
          <section className="question-group">  
            <div className="request-details-header-row">
              <div className="request-details-header-content">
                <h1 className="forge-typography--heading4">Supporting materials</h1>
                <p className="forge-typography--body2">
                  Any existing documentation, designs, data, or visuals that may help inform or accelerate design work.
                </p>
              </div>
              <img
                src="https://cdn.forge.tylertech.com/v1/images/spot/folder-2-spot.svg"
                alt=""
                aria-hidden="true"
                className="request-details-header-image"
              />
            </div>
            <FieldRepeater
              placeholder="https://example.com/supporting-resource"
              values={formValues.supportingLinks}
              onChange={(index, value) => updateArrayField('supportingLinks', index, value)}
              onAdd={() => addArrayItem('supportingLinks')}
              onRemove={(index) => removeArrayItem('supportingLinks', index)}
            />
            <div className="intake-mt-medium">
              <ForgeFilePicker ref={filePickerRef} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.xlsx" multiple>
                <span slot="primary">Drag files here or</span>
                <span slot="secondary">Files must be PDF, Word, Images, CSV, or Excel.</span>
                <ForgeButton variant="outlined" type="button">Select files</ForgeButton>
              </ForgeFilePicker>
            </div>
            {pickedFiles.length ? (
              <ForgeList className="intake-mt-medium">
                {pickedFiles.map((file) => (
                  <ForgeListItem key={file.id}>
                    <ForgeIcon slot="start" name={file.legal ? 'check_circle' : 'error'} external></ForgeIcon>
                    <span>{file.name}</span>
                    {!file.legal && file.error ? <span slot="secondary-text">{file.error}</span> : null}
                    <ForgeIconButton slot="end" dense aria-label={`Remove ${file.name}`} onClick={() => removePickedFile(file.id)}>
                      <ForgeIcon name="close" external></ForgeIcon>
                    </ForgeIconButton>
                  </ForgeListItem>
                ))}
              </ForgeList>
            ) : null}
          </section>
        </ForgeCard>
        <div className="form-actions">
          <ForgeButton type="submit" variant="filled" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </ForgeButton>
        </div>
      </form>
      {statusMessage && <ForgeInlineMessage theme="success">{statusMessage}</ForgeInlineMessage>}
      {errorMessage && <ForgeInlineMessage theme="error">{errorMessage}</ForgeInlineMessage>}
    </>
  )
}
