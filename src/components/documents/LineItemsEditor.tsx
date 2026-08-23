/**
 * LineItemsEditor — Éditeur de lignes pour devis/factures
 *
 * Composant partagé entre devis et factures (même structure de données).
 * Gère :
 * - Ajout / suppression de lignes
 * - Sélection d'un produit existant (auto-remplit désignation + prix)
 * - Saisie libre (produit non catalogué)
 * - Calcul automatique du total par ligne et du sous-total global
 */

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

export type LineItem = {
  product_id: string | null;
  designation: string;
  quantity: number;
  unit_price: number;
};

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Product[]; // Catalogue pour l'autocomplétion
}

const EMPTY_ITEM: LineItem = {
  product_id: null,
  designation: "",
  quantity: 1,
  unit_price: 0,
};

export function LineItemsEditor({ items, onChange, products }: LineItemsEditorProps) {
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  const addItem = () => {
    onChange([...items, { ...EMPTY_ITEM }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  // Quand l'utilisateur sélectionne un produit existant dans la liste suggérée
  const selectProduct = (index: number, product: Product) => {
    updateItem(index, {
      product_id: product.id,
      designation: product.name,
      unit_price: product.price,
    });
    setFocusedRowIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* En-têtes de colonnes (desktop/tablette uniquement, cf. layout empilé mobile) */}
      <div className="hidden sm:grid grid-cols-[1fr_90px_130px_130px_36px] gap-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <span>Désignation / Article</span>
        <span>Quantité</span>
        <span>Prix unitaire</span>
        <span className="text-right">Total HT</span>
        <span></span>
      </div>

      {/* Lignes */}
      {items.map((item, index) => {
        // Filtrer les suggestions selon la saisie
        const suggestions = products.filter((p) =>
          p.name.toLowerCase().includes(item.designation.toLowerCase())
        );

        return (
          <div
            key={index}
            className="grid grid-cols-2 sm:grid-cols-[1fr_90px_130px_130px_36px] gap-2 sm:gap-2 items-start relative border border-gray-200 sm:border-0 rounded-lg p-3 sm:p-0 bg-white sm:bg-transparent"
          >
            {/* Désignation avec suggestions stylisées */}
            <div className="relative col-span-2 sm:col-span-1">
              <input
                value={item.designation}
                onChange={(e) => {
                  updateItem(index, {
                    designation: e.target.value,
                    product_id: null,
                  });
                }}
                onFocus={() => setFocusedRowIndex(index)}
                onBlur={() => setTimeout(() => setFocusedRowIndex(null), 250)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (index === items.length - 1 && item.designation.trim() !== "") {
                      addItem();
                    }
                  }
                }}
                placeholder="Nom du produit ou service..."
                className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 bg-white shadow-sm"
              />

              {/* Dropdown de suggestions de produits */}
              {focusedRowIndex === index && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => selectProduct(index, p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 hover:text-blue-600 transition-colors flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-gray-500 truncate max-w-50">
                            {p.description}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-blue-600">
                        {formatCurrency(p.price)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantité */}
            <div>
              <span className="sm:hidden block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Quantité
              </span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(index, {
                    quantity: parseFloat(e.target.value) || 0,
                  })
                }
                className="bg-white shadow-sm"
              />
            </div>

            {/* Prix unitaire */}
            <div>
              <span className="sm:hidden block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Prix unitaire
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(e) =>
                  updateItem(index, {
                    unit_price: parseFloat(e.target.value) || 0,
                  })
                }
                className="bg-white shadow-sm"
              />
            </div>

            {/* Total de la ligne (calculé, non éditable) */}
            <div className="flex items-center h-10.5 justify-between sm:justify-end text-sm font-semibold text-gray-800 sm:pr-1">
              <span className="sm:hidden text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Total HT
              </span>
              {formatCurrency(item.quantity * item.unit_price)}
            </div>

            {/* Bouton suppression */}
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              className="h-10.5 flex items-center justify-center text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors ml-auto sm:ml-0"
              aria-label="Supprimer la ligne"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}

      {/* Bouton ajouter une ligne */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        leftIcon={<Plus size={14} />}
        onClick={addItem}
        className="mt-2"
      >
        Ajouter une ligne
      </Button>
    </div>
  );
}
