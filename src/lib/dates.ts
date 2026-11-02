/** YYYY-MM-DD in the user's local time zone (toISOString would give the UTC date, a day ahead in the evening). */
export function localISODate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
