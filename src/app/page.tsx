/**
 * Page d'accueil avec boutons d'action
 */
import Link from "next/link";
import { FileText, UserPlus, LogIn, Server } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg">
            <FileText size={40} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Devis<span className="text-blue-600">IA</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Créez des devis professionnels en quelques secondes grâce à l'intelligence artificielle
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <Link href="/sign-up" className="group">
            <Button 
              size="lg" 
              className="w-full h-24 flex flex-col items-center justify-center gap-2 text-lg bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
            >
              <UserPlus size={28} />
              S'inscrire
            </Button>
          </Link>

          <Link href="/sign-in" className="group">
            <Button 
              size="lg" 
              className="w-full h-24 flex flex-col items-center justify-center gap-2 text-lg bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all"
            >
              <LogIn size={28} />
              Se connecter
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <FileText size={24} className="text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Devis instantanés</h3>
            <p className="text-gray-600 text-sm">Générez des devis professionnels en quelques clics</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-md">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <UserPlus size={24} className="text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Gestion clients</h3>
            <p className="text-gray-600 text-sm">Suivez vos clients et leur historique</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-xl p-6 shadow-md">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Server size={24} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">IA intégrée</h3>
            <p className="text-gray-600 text-sm">L'IA vous aide à rédiger vos devis</p>
          </div>
        </div>
      </div>
    </div>
  );
}
