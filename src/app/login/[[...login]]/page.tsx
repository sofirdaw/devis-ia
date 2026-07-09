/**
 * Page de connexion avec Clerk (catch-all route pour compatibilité)
 */

import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn 
        routing="hash"
        forceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </div>
  )
}
