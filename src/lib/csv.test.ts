import { describe, expect, it } from 'vitest'

import { toCsv } from './csv'

describe('toCsv', () => {
  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv(['name', 'reason'], [['Sales, EMEA', 'Said "yes"\nthen no']])

    expect(csv).toContain('"Sales, EMEA","Said ""yes""\nthen no"')
  })

  it('neutralises spreadsheet formulas', () => {
    // A reason typed as =HYPERLINK(...) must not run when the export is opened in Excel.
    expect(toCsv(['a'], [['=HYPERLINK("x")']])).toContain('\'=HYPERLINK')
  })

  it('leaves empty cells empty', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toMatch(/a,b\r\n,$/)
  })
})
