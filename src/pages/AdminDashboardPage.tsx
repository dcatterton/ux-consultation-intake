import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ForgeCard, ForgeInlineMessage, ForgeTable, ForgeTextField } from '@tylertech/forge-react'
import { isCurrentUserAdmin } from '../lib/authz'
import { supabase } from '../lib/supabaseClient'
import type { IntakeSubmissionRow } from '../types'

type TableColumnConfiguration = {
  property: keyof DashboardTableRow
  header: string
}

type DashboardTableRow = {
  id: string
  createdAtDisplay: string
  requesterName: string
  application: string
  moduleName: string
  deadlineDisplay: string
}

const TABLE_COLUMNS: TableColumnConfiguration[] = [
  { property: 'createdAtDisplay', header: 'Date/Time' },
  { property: 'requesterName', header: 'Requester' },
  { property: 'application', header: 'Application' },
  { property: 'moduleName', header: 'Module or feature' },
  { property: 'deadlineDisplay', header: 'Deadline date' },
]

function formatDateTime(value: string): string {
  if (!value) return 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function AdminDashboardPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [rows, setRows] = useState<IntakeSubmissionRow[]>([])
  const [filterText, setFilterText] = useState('')
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

      const { data, error } = await supabase
        .from('intake_submissions')
        .select('id, submitted_email, payload, status, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMessage(`Unable to load submissions right now. ${error.message}`)
        return
      }

      const normalizedRows: IntakeSubmissionRow[] = (data ?? []).map((row) => {
        const payload = row.payload ?? {}
        return {
          id: row.id,
          submitted_email: row.submitted_email ?? '',
          payload: row.payload,
          full_name: typeof payload.full_name === 'string' ? payload.full_name : 'Not provided',
          email:
            typeof payload.email === 'string'
              ? payload.email
              : row.submitted_email ?? 'Not provided',
          organization:
            typeof payload.organization === 'string' ? payload.organization : null,
          details: typeof payload.details === 'string' ? payload.details : '',
          status: row.status ?? 'new',
          created_at: row.created_at,
        }
      })

      setRows(normalizedRows)
    }

    void guardAndLoad()
  }, [navigate])

  const dashboardRows = useMemo<DashboardTableRow[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        createdAtDisplay: formatDateTime(row.created_at),
        requesterName:
          typeof row.payload?.requesterName === 'string'
            ? row.payload.requesterName
            : row.full_name || 'Not provided',
        application:
          typeof row.payload?.application === 'string' && row.payload.application.trim()
            ? row.payload.application
            : row.organization || 'Not provided',
        moduleName:
          typeof row.payload?.moduleName === 'string' && row.payload.moduleName.trim()
            ? row.payload.moduleName
            : 'Not provided',
        deadlineDisplay: formatDate(typeof row.payload?.deadline === 'string' ? row.payload.deadline : null),
      })),
    [rows],
  )

  const filteredRows = useMemo<DashboardTableRow[]>(() => {
    if (!filterText.trim()) return dashboardRows
    const query = filterText.toLowerCase()
    return dashboardRows.filter((row) =>
      [row.requesterName, row.application, row.moduleName, row.deadlineDisplay, row.createdAtDisplay].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [dashboardRows, filterText])

  function handleTableNavigate(event: Event) {
    const customEvent = event as CustomEvent<{ data?: DashboardTableRow }>
    const rowId = customEvent.detail?.data?.id
    if (rowId) navigate(`/admin/submissions/${rowId}`)
  }

  if (isAuthorized === null) {
    return <ForgeInlineMessage theme="info">Loading dashboard...</ForgeInlineMessage>
  }

  return (
    <ForgeCard>
      <section className="page-section">
        <h1 className="forge-typography--heading4">Admin Dashboard</h1>
        <p className="forge-typography--body1">Review intake form submissions.</p>
      </section>
      <div className="dashboard-toolbar">
        <ForgeTextField label-position="block-start">
          <label htmlFor="submission-filter">Filter Submissions</label>
          <input
            id="submission-filter"
            type="text"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
        </ForgeTextField>
        <div className="form-actions">
          <Link to="/" className="link-inline">
            View Public Form
          </Link>
        </div>
      </div>
      <ForgeTable
        data={filteredRows}
        columnConfigurations={TABLE_COLUMNS}
        multiselect={false}
        selectKey="id"
        allowRowClick
        {...{
          'on-forge-table-row-click': handleTableNavigate,
          'on-forge-table-select': handleTableNavigate,
        }}
      ></ForgeTable>
      {errorMessage && <ForgeInlineMessage theme="error">{errorMessage}</ForgeInlineMessage>}
    </ForgeCard>
  )
}
