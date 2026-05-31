import type { CreditsSummary } from '~~/app/utils/credits'
import { creditPacks } from '~~/app/utils/credits'
import { getCreditBalance, listCreditTransactions, listPurchasedPdfs } from '~~/server/utils/credits'

export default defineEventHandler(async (event): Promise<CreditsSummary> => {
  const session = await requireUserSession(event)
  const sql = useNeon(event)
  const [balance, transactions, pdfs] = await Promise.all([
    getCreditBalance(sql, session.user.id),
    listCreditTransactions(sql, session.user.id),
    listPurchasedPdfs(sql, session.user.id)
  ])

  return {
    balance,
    packs: creditPacks,
    pdfs,
    transactions
  }
})
