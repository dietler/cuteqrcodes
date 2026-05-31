import { beforeAll, describe, expect, test } from 'bun:test'
import { createError } from 'h3'
import { createOrUpdateDynamicQrLink } from '../../server/utils/dynamic-qr'

beforeAll(() => {
  Object.assign(globalThis, { createError })
})

describe('dynamic QR links', () => {
  test('rejects an update for a missing existing link before charging or creating', async () => {
    const sql = createMockSql((query) => {
      if (query.includes('to_regclass')) {
        return [{
          credit_transactions: 'credit_transactions',
          dynamic_qr_links: 'dynamic_qr_links',
          dynamic_qr_scans: 'dynamic_qr_scans',
          purchased_pdfs: 'purchased_pdfs',
          user_credit_balances: 'user_credit_balances'
        }]
      }

      if (query.includes('from dynamic_qr_links') && query.includes('where id =')) {
        return []
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    await expect(createOrUpdateDynamicQrLink(sql, {
      destinationUrl: 'https://example.com/',
      existingLinkId: 'missing-link',
      slug: 'example',
      trackStatistics: true,
      useDynamicUrl: true,
      userId: 'user-1'
    })).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Dynamic QR link not found.'
    })

    expect(sql.calls.some(query => query.includes('update user_credit_balances'))).toBe(false)
    expect(sql.calls.some(query => query.includes('insert into dynamic_qr_links'))).toBe(false)
  })
})

function createMockSql(respond: (query: string, values: unknown[]) => Record<string, unknown>[]) {
  const calls: string[] = []

  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim()

    calls.push(query)

    return respond(query, values)
  }) as ReturnType<typeof useNeon> & { calls: string[] }

  sql.calls = calls

  return sql
}
