export const INTAKE_ATTACHMENTS_BUCKET = 'intake-attachments'

export type SubmissionAttachment = {
  name: string
  path: string
  size?: number
  contentType?: string
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || 'file'
  return trimmed.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180)
}

export function buildAttachmentPath(folderId: string, fileName: string): string {
  return `${folderId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`
}

export function parseAttachments(value: unknown): SubmissionAttachment[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const path = typeof record.path === 'string' ? record.path.trim() : ''
    if (!name || !path) return []

    return [
      {
        name,
        path,
        size: typeof record.size === 'number' ? record.size : undefined,
        contentType: typeof record.contentType === 'string' ? record.contentType : undefined,
      },
    ]
  })
}
