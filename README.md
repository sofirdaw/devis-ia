# DevisIA — Assistant IA pour Devis & Factures

Application web moderne de gestion de devis et factures avec intelligence artificielle, conçue pour les entreprises africaines. Permet de créer des documents professionnels en quelques secondes grâce à l'IA.

## 🚀 Fonctionnalités

- **Génération IA de devis** : Créez des devis à partir de descriptions en langage naturel
- **Gestion complète** : Devis, factures, clients, produits, fournisseurs
- **Suivi des créances** : Tableau de bord avec statistiques et graphiques
- **Impression directe** : Génération de PDF professionnels
- **Authentification sécurisée** : Intégration avec Clerk
- **Base de données robuste** : Supabase avec Row Level Security
- **Interface moderne** : Design responsive avec Tailwind CSS

## 📋 Prérequis

- Node.js 20+
- npm ou yarn
- Un compte Supabase (gratuit)
- Un compte Clerk (gratuit)
- Clé API OpenAI ou Groq (pour l'IA)

## 🛠️ Installation

### 1. Cloner le projet

```bash
git clone <votre-repo-url>
cd devis-ai
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans le SQL Editor et exécutez le fichier `supabase/schema.sql`
3. Créez les buckets de stockage :
   - Bucket `logos` (public) : pour les logos d'entreprise
   - Bucket `pdfs` (privé) : pour les PDF générés
4. Récupérez vos clés API dans Settings → API

### 4. Configurer Clerk

1. Créez une application sur [clerk.com](https://clerk.com)
2. Activez l'authentification par email/mot de passe
3. Configurez les redirections :
   - Après connexion : `/dashboard`
   - après déconnexion : `/sign-in`
4. Récupérez vos clés API dans Dashboard → API Keys

### 5. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
# URL canonique utilisée pour les flux OAuth et PKCE
NEXT_PUBLIC_SITE_URL=https://dev-fac-ia.vercel.app

# Cache Redis (Upstash, Redis Cloud ou Redis managé)
# Laisser vide en développement désactive le cache sans bloquer l'application.
REDIS_URL=redis://:mot_de_passe@hote:6379

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=votre_cle_publique_clerk
CLERK_SECRET_KEY=votre_cle_secrete_clerk

# OpenAI / Groq (pour l'IA)
OPENAI_API_KEY=votre_cle_openai
GROQ_API_KEY=votre_cle_groq  # Optionnel, alternative gratuite
```

Après avoir appliqué `supabase/migrations/migration_add_subscriptions.sql` dans
Supabase, les entreprises disposent des dates `trial_started_at` et
`trial_ends_at` pour l'essai gratuit, ainsi que `subscription_started_at` et
`subscription_expires_at` pour les abonnements payants. Un administrateur peut
suspendre ou réactiver un compte depuis `/admin/subscriptions`.

### 6. Lancer le projet

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## 📁 Structure du projet

```
devis-ai/
├── src/
│   ├── app/                    # Pages Next.js (App Router)
│   │   ├── (dashboard)/       # Pages protégées (dashboard)
│   │   │   ├── dashboard/     # Tableau de bord
│   │   │   ├── quotes/        # Gestion des devis
│   │   │   ├── invoices/      # Gestion des factures
│   │   │   ├── clients/       # Gestion des clients
│   │   │   ├── products/      # Gestion des produits
│   │   │   ├── suppliers/     # Gestion des fournisseurs
│   │   │   ├── receivables/   # Suivi des créances
│   │   │   └── settings/      # Paramètres entreprise
│   │   ├── actions/           # Server Actions
│   │   ├── api/               # API Routes
│   │   └── layout.tsx         # Layout racine
│   ├── components/            # Composants React
│   │   ├── dashboard/         # Composants dashboard
│   │   ├── documents/         # Composants documents
│   │   ├── layout/            # Header, Sidebar, UserMenu
│   │   └── settings/          # Composants paramètres
│   ├── lib/                   # Utilitaires et configurations
│   │   ├── supabase/          # Client Supabase
│   │   ├── openai.ts          # Client OpenAI/Groq
│   │   ├── auth.ts            # Configuration auth
│   │   └── utils.ts           # Fonctions utilitaires
│   ├── store/                 # État global (Zustand)
│   └── types/                 # Types TypeScript
├── supabase/                  # Schéma et migrations SQL
│   ├── schema.sql             # Schéma complet de la base
│   └── migrations/            # Migrations
└── public/                    # Fichiers statiques
```

## 🗄️ Schéma de la base de données

L'application utilise les tables suivantes :

- **companies** : Informations des entreprises
- **clients** : Liste des clients
- **products** : Catalogue de produits
- **suppliers** : Liste des fournisseurs
- **quotes** : Devis
- **quote_items** : Lignes de devis
- **invoices** : Factures
- **invoice_items** : Lignes de factures
- **receivables** : Suivi des créances

Toutes les tables sont protégées par Row Level Security (RLS) pour garantir que chaque utilisateur ne voit que ses propres données.

## 🔐 Sécurité

- **Autorisation** : Row Level Security sur Supabase
- **Validation** : Zod pour la validation des formulaires
- **Protection** : Server Actions pour les opérations sensibles

## 🎨 Technologies utilisées

- **Framework** : Next.js 16 (App Router)
- **Langage** : TypeScript
- **Styling** : Tailwind CSS 4
- **UI Components** : Radix UI (shadcn/ui)
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : Clerk
- **IA** : OpenAI / Groq
- **PDF** : @react-pdf/renderer
- **Graphiques** : Recharts
- **État** : Zustand
- **Formulaires** : React Hook Form + Zod

## 📝 Scripts disponibles

```bash
npm run dev      # Lance le serveur de développement
npm run build    # Build pour production
npm run start    # Lance le serveur de production
npm run lint     # Exécute ESLint
```

## 🚀 Déploiement

### Vercel (recommandé)

1. Poussez votre code sur GitHub
2. Importez le projet sur [Vercel](https://vercel.com)
3. Configurez les variables d'environnement, notamment `NEXT_PUBLIC_SITE_URL` avec le domaine public canonique
4. Dans Supabase, ajoutez `https://dev-fac-ia.vercel.app/auth/callback` aux Redirect URLs et utilisez la même URL comme Site URL
5. Déployez

### Autres plateformes

L'application peut être déployée sur n'importe quelle plateforme supportant Next.js :

- Netlify
- Railway
- Render
- Docker

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou un pull request.

## 📄 Licence

Ce projet est sous licence MIT.

## 🆘 Support

Pour toute question ou problème :

- Ouvrez une issue sur GitHub
- Consultez la documentation Next.js
- Consultez la documentation Supabase
- Consultez la documentation Clerk

# devis-ia
