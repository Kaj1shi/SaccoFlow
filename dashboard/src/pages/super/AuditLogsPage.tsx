import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { EmptyState, ErrorNote, PageHeader, Spinner, TableShell } from '../../components/ui'
import type { AuditLog } from '../../types'

interface AuditRow extends AuditLog {
  institutions?: { name: string } | null
  users?: { first_name: string; last_name: string } | null
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, institutions(name), users(first_name,last_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) setError(error.message)
      setLogs((data as AuditRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Latest 200 recorded system actions" />

      {error && <ErrorNote message={error} />}

      {logs.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          hint="Audit entries appear here as the system records administrative actions."
        />
      ) : (
        <TableShell headers={['When', 'SACCO', 'User', 'Action', 'Table']}>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 text-slate-500">{formatDateTime(l.created_at)}</td>
              <td className="px-4 py-3 text-slate-600">{l.institutions?.name ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">
                {l.users ? `${l.users.first_name} ${l.users.last_name}` : '—'}
              </td>
              <td className="px-4 py-3 font-medium capitalize text-slate-800">{l.action}</td>
              <td className="px-4 py-3 text-slate-600">{l.table_name}</td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  )
}
