/**
 * Page d'inscription avec Clerk (catch-all route)
 */

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp 
        routing="hash"
        forceRedirectUrl="/dashboard"
      />
    </div>
  )
}
