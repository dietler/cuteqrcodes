import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient()
export const { requestPasswordReset, resetPassword, signIn, signOut, signUp, useSession } = authClient
