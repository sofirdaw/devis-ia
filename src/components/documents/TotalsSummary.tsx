/**
 * TotalsSummary — Récapitulatif des totaux (sous-total, remise, TVA, total)
 * Affiché à droite du formulaire de devis/facture
 */

import { Input } from "@/components/ui/input";
import { formatCurrency, calculateTotals } from "@/lib/utils";
import type { LineItem } from "./LineItemsEditor";

interface TotalsSummaryProps {
  items: LineItem[];
  taxRate: number; // TVA en %, vient de l'entreprise
  discount: number;
  onDiscountChange: (value: number) => void;
}

export function TotalsSummary({ items, taxRate, discount, onDiscountChange }: TotalsSummaryProps) {
  const { subtotal, tax, total } = calculateTotals(items, taxRate, discount);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">Récapitulatif</h3>
      
      {/* Sous-total */}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Sous-total HT</span>
        <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
      </div>

      {/* Remise (éditable) */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Remise (FCFA)</span>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount || ""}
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            className="w-32 text-right rounded-lg border border-gray-300 text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 bg-gray-50/50"
            placeholder="0"
          />
        </div>
      </div>

      {/* TVA */}
      {taxRate > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">TVA ({taxRate}%)</span>
          <span className="font-medium text-gray-900">{formatCurrency(tax)}</span>
        </div>
      )}

      {/* Séparateur & Total */}
      <div className="border-t border-gray-150 pt-4 flex flex-col gap-1">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-semibold text-gray-700">Montant Total TTC</span>
          <span className="text-2xl font-bold text-blue-600 tracking-tight">{formatCurrency(total)}</span>
        </div>
        {discount > 0 && (
          <div className="text-right text-xs text-green-600 font-medium animate-pulse">
            Économie de {formatCurrency(discount)} appliquée !
          </div>
        )}
      </div>
    </div>
  );
}
