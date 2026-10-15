import Link from "next/link";
import { BookOpen, CircleHelp, ShieldCheck, Sparkles } from "lucide-react";
import { Header } from "@/components/layout";

const guides = [
  {
    title: "Configurer votre entreprise",
    steps: [
      "Ouvrez Paramètres pour renseigner le nom, les coordonnées et les informations fiscales.",
      "Ajoutez vos clients, produits et fournisseurs avant de créer vos premiers documents.",
      "Vos coordonnées et votre logo peuvent être repris dans les PDF générés.",
    ],
  },
  {
    title: "Créer un devis avec l’IA",
    steps: [
      "Ouvrez Devis IA, décrivez clairement le client, les articles, quantités et prix, ou ajoutez une photo lisible.",
      "Vérifiez et corrigez le résultat proposé par l’IA avant d’enregistrer le devis.",
      "L’IA peut se tromper : contrôlez toujours les montants et les informations client.",
    ],
  },
  {
    title: "Gérer les devis et factures",
    steps: [
      "Créez ou modifiez vos devis puis suivez leur état depuis la liste des devis.",
      "Transformez un devis en facture lorsque nécessaire et mettez à jour son statut après paiement.",
      "Consultez les créances pour suivre les montants restant dus et les règlements reçus.",
    ],
  },
  {
    title: "Abonnement Orange Money",
    steps: [
      "Choisissez un forfait et composez le code USSD affiché dans l’application.",
      "Saisissez le PIN uniquement dans le menu officiel Orange Money, jamais dans Devis IA.",
      "Après paiement, saisissez la référence de transaction du SMS. L’équipe vérifie le paiement avant d’activer l’accès.",
    ],
  },
  {
    title: "Utilisation hors ligne",
    steps: [
      "Connectez-vous d’abord avec Internet et laissez l’application charger vos données.",
      "Les éléments pris en charge peuvent ensuite être consultés ou modifiés hors ligne.",
      "Les changements en attente se synchronisent au retour du réseau. Gardez la page ouverte jusqu’à la fin de la synchronisation.",
    ],
  },
];

const commonIssues = [
  {
    title: "Je ne peux pas me connecter",
    body: "Vérifiez votre connexion, l’adresse e-mail utilisée et le fournisseur de connexion choisi. Pour Google, relancez le parcours dans le même navigateur et ne réutilisez pas un ancien onglet de connexion.",
  },
  {
    title: "La génération IA échoue",
    body: "Vérifiez la connexion, réessayez avec une description plus courte et précise, ou utilisez une image nette. Contrôlez ensuite manuellement chaque ligne et chaque prix.",
  },
  {
    title: "Mon paiement ou mon abonnement n’apparaît pas",
    body: "Vérifiez que le paiement Orange Money a abouti, puis transmettez la référence exacte du SMS dans la demande en attente. L’accès reste en vérification jusqu’à la confirmation de l’équipe.",
  },
  {
    title: "Mes changements hors ligne ne sont pas synchronisés",
    body: "Reconnectez l’appareil à Internet, laissez l’application ouverte et utilisez le bouton Réessayer si un message de synchronisation l’affiche. Évitez de supprimer les données du navigateur tant que la synchronisation n’est pas terminée.",
  },
];

export default function HelpPage() {
  return (
    <>
      <Header
        title="Centre d’aide"
        description="Guide d’utilisation, bonnes pratiques et solutions aux problèmes courants"
      />
      <main className="page-container max-w-5xl space-y-8">
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
          <div className="flex gap-3">
            <ShieldCheck className="shrink-0 text-blue-700" />
            <p>
              Devis IA ne vous demandera jamais votre mot de passe Google, votre code secret Orange
              Money ni un OTP. Ne partagez jamais ces secrets, même avec une personne se présentant
              comme administrateur.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-700" />
            <h2 className="text-xl font-bold text-gray-950">Guide d’utilisation</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {guides.map((guide) => (
              <article key={guide.title} className="rounded-xl border border-gray-200 bg-white p-5">
                <h3 className="font-semibold text-gray-950">{guide.title}</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            ))}
            <article className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-orange-600" />
                <h3 className="font-semibold text-gray-950">Bien utiliser l’IA</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Donnez uniquement les informations nécessaires à votre devis. Le résultat est une
                proposition à vérifier, pas une validation comptable ou juridique.
              </p>
            </article>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="text-orange-600" />
            <h2 className="text-xl font-bold text-gray-950">Problèmes fréquents</h2>
          </div>
          <div className="space-y-3">
            {commonIssues.map((issue) => (
              <details key={issue.title} className="rounded-xl border border-gray-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold text-gray-950">
                  {issue.title}
                </summary>
                <p className="mt-3 text-sm leading-6 text-gray-600">{issue.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
          <h2 className="font-semibold text-gray-950">Diagnostic technique</h2>
          <p className="mt-2">
            Pour améliorer la stabilité, l’application transmet automatiquement des événements
            techniques limités : type d’erreur, page concernée et date. Ces données sont rattachées
            à votre entreprise, conservées au maximum 90 jours et visibles uniquement par
            l’administration. Le contenu de vos devis, factures, images, textes saisis, mots de
            passe et codes de paiement n’est pas inclus dans ces événements.
          </p>
          <p className="mt-3">
            Vous pouvez consulter ou modifier les coordonnées de votre entreprise dans{" "}
            <Link href="/settings" className="font-semibold text-blue-700 underline">
              Paramètres
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
