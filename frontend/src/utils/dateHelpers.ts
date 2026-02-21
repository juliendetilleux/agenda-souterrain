/**
 * Format a datetime string as an iCal DTSTART value.
 * Timed events: "20250615T103000"
 * All-day events: "20250615"
 */
export function formatDtstart(dt: string, allDay: boolean): string {
  const d = new Date(dt)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (allDay) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  }
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * Compute the duration between two datetimes as "HH:MM".
 */
export function computeDuration(startDt: string, endDt: string): string {
  const ms = new Date(endDt).getTime() - new Date(startDt).getTime()
  const totalMinutes = Math.max(Math.round(ms / 60000), 0)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
