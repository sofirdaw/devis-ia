/**
 * Proxy Next.js (anciennement "middleware") — Protection des routes avec Clerk
 *
 * Logique :
 * - Routes publiques (/sign-in, /sign-up, /register, /login) : accessibles sans connexion
 * - Routes protégées (/dashboard, /clients, etc.) : redirige vers /sign-in si non connecté
 * - Route racine (/) : redirige vers /dashboard si connecté, sinon vers /sign-in
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/register(.*)', '/login(.*)', '/'])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
