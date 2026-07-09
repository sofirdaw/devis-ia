/**
 * Page d'inscription avec Clerk (catch-all route pour compatibilité)
 */

import { SignUp } from '@clerk/nextjs'

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp 
        routing="hash"
        forceRedirectUrl="/dashboard"
      />
    </div>
  )
}
