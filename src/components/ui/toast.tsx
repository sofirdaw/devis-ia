/**
 * Composant Toast — Notifications temporaires
 * Simple implémentation sans Radix Toast pour éviter la complexité
 * Usage : via le hook useToast()
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

// Contexte global pour les toasts
type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = React.createContext<ToastContextType>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    // Retirer automatiquement après 4 secondes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />,
    error: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
    info: <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Conteneur des toasts — coin bas droit */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in slide-in-from-right-5",
              t.type === "success" && "border-green-100",
              t.type === "error" && "border-red-100",
              t.type === "info" && "border-blue-100"
            )}
          >
            {icons[t.type]}
            <p className="text-sm text-gray-700 flex-1">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook pour afficher des notifications depuis n'importe quel composant */
export function useToast() {
  return React.useContext(ToastContext);
}
