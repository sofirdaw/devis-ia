/**
 * RecentDocumentsList — Liste des 5 derniers devis ou factures
 * Composant générique réutilisé pour les deux types de documents
 */

import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface RecentDoc {
  id: string;
  number: string;
  total: number;
  status: string;
  created_at: string;
  client_name: string;
}

interface RecentDocumentsListProps {
  title: string;
  documents: RecentDoc[];
  basePath: "quotes" | "invoices";
  viewAllHref: string;
}

export function RecentDocumentsList({
  title,
  documents,
  basePath,
  viewAllHref,
}: RecentDocumentsListProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <Link href={viewAllHref} className="text-xs text-blue-600 hover:underline">
          Voir tout
        </Link>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Aucun document pour le moment</p>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/${basePath}/${doc.id}`}
              className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 font-mono text-xs">{doc.number}</p>
                <p className="text-xs text-gray-500 truncate">{doc.client_name}</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="hidden md:inline text-xs text-gray-400">
                  {formatDate(doc.created_at)}
                </span>
                <StatusBadge status={doc.status} />
                <span className="text-xs sm:text-sm font-medium text-gray-900 w-16 sm:w-24 text-right">
                  {formatCurrency(doc.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
