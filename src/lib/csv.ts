/**
 * Builds a CSV and hands it to the browser as a download.
 *
 * Every "Export" button on the console ends here. One implementation means quoting is
 * right once: a cost centre named `Sales, EMEA` or a reason with a line break must not
 * shift every column after it.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(cell).join(','))

  // A byte-order mark, so Excel opens the naira sign and names with diacritics as UTF-8
  // rather than guessing a legacy code page.
  return `\uFEFF${lines.join('\r\n')}`
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)

  // Leading =, +, - or @ is a formula to a spreadsheet. A trip log row that begins with
  // "=HYPERLINK(...)" typed into a reason field would run when the export is opened.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text

  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function downloadCsv(filename: string, headers: readonly string[], rows: readonly (readonly (string | number | null | undefined)[])[]): void {
  downloadText(filename, toCsv(headers, rows), 'text/csv;charset=utf-8')
}

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Revoked on the next tick rather than immediately: Safari cancels the download if the
  // URL disappears before the click has been processed.
  setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}
