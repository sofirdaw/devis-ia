# DevisIA — Assistant IA pour Devis & Factures

Application web moderne de gestion de devis et factures avec intelligence artificielle, conçue pour les entreprises africaines. Permet de créer des documents professionnels en quelques secondes grâce à l'IA.

## 🚀 Fonctionnalités

- **Génération IA de devis** : Créez des devis à partir de descriptions en langage naturel
- **Gestion complète** : Devis, factures, clients, produits, fournisseurs
- **Suivi des créances** : Tableau de bord avec statistiques et graphiques
- **Impression directe** : Génération de PDF professionnels
- **Authentification sécurisée** : Supabase Auth
- **Base de données robuste** : Supabase avec Row Level Security
- **Interface moderne** : Design responsive avec Tailwind CSS
- **Mode hors-ligne** : Cache local des données métier, créations/modifications/suppressions en file d'attente, puis synchronisation au retour du réseau
- **OCR local** : Reconnaissance française exécutée sur l'appareil, sans appel réseau après le chargement initial

## 📋 Prérequis

- Node.js 20+
- npm ou yarn
- Un compte Supabase (gratuit)
- Un projet Supabase avec Auth et l'envoi d'e-mails configurés
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

### 4. Configurer les variables d'environnement

Créez un fichier `.env.local` à la racine du projet :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon_supabase
# Clé service role, réservée au serveur (ne jamais préfixer par NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
# URL canonique utilisée pour les flux OAuth et PKCE
NEXT_PUBLIC_SITE_URL=https://dev-fac-ia.vercel.app

# Cache Redis (Upstash, Redis Cloud ou Redis managé)
# Laisser vide en développement désactive le cache sans bloquer l'application.
REDIS_URL=redis://:mot_de_passe@hote:6379

# OpenAI / Groq (pour l'IA)
OPENAI_API_KEY=votre_cle_openai  # Facultatif, doit être valide si renseignée
GROQ_API_KEY=votre_cle_groq
GEMINI_API_KEY=votre_cle_gemini  # Recommandé comme fournisseur de secours
# Modèles Groq actifs (facultatif : ces valeurs sont les valeurs par défaut)
GROQ_TEXT_MODEL=openai/gpt-oss-20b
GROQ_TEXT_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
```

La clé `SUPABASE_SERVICE_ROLE_KEY` est utilisée uniquement par les routes
serveur d'administration. Ne la transmettez jamais au navigateur ni au dépôt.
Les identifiants Groq Llama 3.3 70B et Llama 3.1 8B précédents ont été retirés
par Groq en août 2026 ; le projet utilise maintenant les modèles recommandés
`openai/gpt-oss-20b` et `openai/gpt-oss-120b`. Pour la production, ajoutez les
clés IA dans Vercel et vérifiez qu'elles sont actives : une réponse HTTP 401
signifie qu'une clé est invalide ou révoquée, pas que le quota est épuisé.
Gemini utilise `gemini-3.8-flash` par défaut. La dictée vocale utilise l'API
native du navigateur quand elle est disponible ; seule l'analyse du texte
transcrit nécessite un fournisseur IA. Les descriptions avec prix et quantités
clairs sont d'abord analysées localement pour éviter les erreurs de format et
économiser le quota ; les cas ambigus sont envoyés aux modèles IA configurés.

Après avoir appliqué `supabase/migrations/migration_add_subscriptions.sql` dans
Supabase, les entreprises disposent des dates `trial_started_at` et
`trial_ends_at` pour l'essai gratuit, ainsi que `subscription_started_at` et
`subscription_expires_at` pour les abonnements payants. Un administrateur peut
suspendre ou réactiver un compte depuis `/admin/subscriptions`.

Pour utiliser le mode hors-ligne, l'utilisateur doit d'abord se connecter avec
Internet, ouvrir l'application et attendre le snapshot ainsi que le précache des
routes et ressources locales. Clients, produits, fournisseurs, devis, factures,
créances, paramètres d'entreprise et logo sont alors disponibles depuis
l'appareil. Les modifications métier et paiements de créances pris en charge
sont enregistrés localement et rejoués dans l'ordre au retour du réseau. Les
écrans visités/préchargés peuvent être rouverts sans connexion ; les nouvelles
connexions, générations IA, conversions nécessitant une validation distante et
PDF distants restent indisponibles hors-ligne.

L'accès reste limité à la date d'expiration d'abonnement connue par l'appareil.
Un achat, une confirmation de paiement ou une activation d'abonnement requiert
Internet et une validation serveur ; le client n'accorde jamais localement un
abonnement payant. Les mutations locales de paramètres ne modifient pas le
forfait. Avant déploiement, appliquer dans Supabase
`supabase/migrations/migration_idempotent_offline_receivable_payments.sql`
pour assurer l'idempotence des paiements de créances, ainsi que
`supabase/migrations/migration_harden_manual_subscription_payments.sql` pour
les garde-fous des paiements d'abonnement. Les migrations comparent
`companies.user_id` à l'identifiant Supabase Auth après conversion explicite en
texte, car `companies.user_id` peut être une colonne `TEXT`. Si les migrations
d'abonnement ont déjà été appliquées avant cette correction, réexécuter les
fichiers `migration_add_subscriptions.sql`,
`migration_harden_manual_subscription_payments.sql` et
`fix_subscription_payments_rls.sql`, dans cet ordre, dans le SQL Editor de
Supabase.
Après déploiement d'une mise à jour de `migration_harden_manual_subscription_payments.sql`,
réexécutez ce fichier dans Supabase pour que les validations et le webhook
ajoutent chaque nouveau forfait après la date d'expiration payante ou la fin
d'essai gratuit, si elle est plus tardive. Le tableau de bord présente le
nombre total de jours restants jusqu'à l'expiration.

Pour le panel de suivi client et les événements techniques, appliquer également
`supabase/migrations/migration_add_client_issue_events.sql`, puis
`supabase/migrations/migration_add_admin_company_purge.sql` (après les
migrations créant factures, devis, créances, fournisseurs et abonnements). Configurer
`CRON_SECRET` dans les variables d'environnement Vercel pour purger chaque jour
les événements techniques de plus de 90 jours. La file temporaire hors ligne
est isolée par compte et ne contient que des catégories d’événements, des routes
sans paramètres et des codes techniques autorisés. La création de comptes par
l'administration envoie une invitation Supabase Auth : le service d'e-mail
Supabase doit être configuré. Le panel ne lit ni ne définit de mot de passe.

Le paiement Orange Money manuel demande au client la référence de transaction
indiquée dans son SMS de confirmation ; le code secret ou OTP Orange Money ne
doit jamais être saisi dans l'application. L'administrateur vérifie la
référence avec le paiement reçu avant d'activer l'abonnement. Après ajout de
ce champ, réexécuter `migration_add_subscriptions.sql`, puis
`migration_harden_manual_subscription_payments.sql` dans Supabase pour
actualiser les installations existantes.

Pour les PDF, appliquer également
`supabase/migrations/migration_add_pdf_templates.sql` dans Supabase. Chaque
entreprise peut alors sélectionner séparément un modèle classique, moderne ou
minimaliste pour ses devis et ses factures, et activer ou désactiver l'en-tête
de chacun. L'en-tête reprend le logo et les coordonnées de l'entreprise ainsi
que les identifiants renseignés (RCCM, IFU et CME). Pour afficher les activités
ou services de l'entreprise à droite du logo et de son nom, renseigner le champ
dédié dans les préférences puis appliquer
`supabase/migrations/migration_add_company_service_description.sql`.
Pour conserver la synchronisation entre factures, créances et paiements,
appliquer d'abord `supabase/migrations/fix_receivable_invoice_sync.sql`, puis
`supabase/migrations/migration_add_cancelled_document_status.sql`. Cette
dernière ajoute l'annulation des devis, factures et créances liées ; les montants
annulés sont exclus des soldes actifs, sans supprimer l'historique des paiements.
Le tableau de bord utilise les transactions de paiement, y compris les
règlements partiels, en ligne comme hors ligne.

Les ressources du moteur OCR français sont copiées depuis les dépendances
pendant `npm run dev` et `npm run build`, puis précachées par le service worker.
Le premier démarrage doit donc se faire en ligne pour charger le modèle OCR et
les routes de l'application utilisées hors-ligne. Le service worker n'est pas
activé en développement : valider le parcours réseau coupé sur un build de
production servi par `npm run start` ou sur l'application déployée.

### 5. Lancer le projet

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
- **Authentification** : Supabase Auth
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
3. Configurez les variables d'environnement, notamment `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `CRON_SECRET`
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

# devis-ia
