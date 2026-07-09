/**
 * Layout du groupe (auth) — Pages de connexion et inscription
 * Centrage vertical + fond dégradé léger
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
