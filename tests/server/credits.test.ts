import { beforeAll, describe, expect, test } from 'bun:test'
import { createError } from 'h3'
import { getCreditBalance } from '../../server/utils/credits'

beforeAll(() => {
  Object.assign(globalThis, { createError })
})

describe('credits', () => {
  test('reads existing balances without conflict updates', async () => {
    const sql = createMockSql((query) => {
      if (query.includes('to_regclass')) {
        return [{
          credit_transactions: 'credit_transactions',
          purchased_pdfs: 'purchased_pdfs',
          user_credit_balances: 'user_credit_balances'
        }]
      }

      if (query.includes('with inserted_balance as')) {
        return [{ balance: 7 }]
      }

      throw new Error(`Unexpected query: ${query}`)
    })

    await expect(getCreditBalance(sql, 'user-1')).resolves.toBe(7)
    expect(sql.calls.some(query => query.includes('do update'))).toBe(false)
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
