const ugx = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0,
})

export function formatMoney(value: number | null | undefined): string {
  return ugx.format(Number(value ?? 0))
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-UG').format(Number(value ?? 0))
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function fullName(row: { first_name?: string | null; last_name?: string | null }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(' ') || '—'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Generate a readable unique reference like TXN-2026-483920 */
export function genRef(prefix: string): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')
  return `${prefix}-${year}-${rand}`
}
