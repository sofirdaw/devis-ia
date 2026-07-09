/**
 * Configuration NextAuth.js
 * Utilise la base de données PostgreSQL existante (Supabase) pour stocker les utilisateurs
 */

import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { Pool } from "pg"

// Connexion à la base de données PostgreSQL (utilise DIRECT_URL pour éviter IPv6)
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log('Authorize appelé avec:', credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.log('Credentials manquants');
          return null
        }

        try {
          // Vérifier si l'utilisateur existe dans la table companies
          const result = await pool.query(
            `SELECT * FROM companies WHERE email = $1`,
            [credentials.email]
          )

          console.log('Utilisateur trouvé:', result.rows.length > 0);

          if (result.rows.length === 0) {
            console.log('Aucun utilisateur trouvé');
            return null
          }

          const user = result.rows[0]
          console.log('Données utilisateur:', { email: user.email, hasPassword: !!user.password_hash });

          // Vérifier le mot de passe
          if (user.password_hash && typeof credentials.password === 'string') {
            const passwordMatch = await compare(credentials.password, user.password_hash)
            console.log('Password match:', passwordMatch);
            if (!passwordMatch) {
              console.log('Password incorrect');
              return null
            }
          }

          console.log('Autorisation réussie pour:', user.email);
          return {
            id: user.user_id,
            email: user.email,
            name: user.name,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
})
