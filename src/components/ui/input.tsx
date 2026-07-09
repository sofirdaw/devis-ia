/**
 * Composant Input — Champ de saisie réutilisable
 * 
 * Fonctionnalités :
 * - Label intégré avec indicateur "requis"
 * - Message d'erreur affiché en rouge sous le champ
 * - Support d'icône gauche/droite
 * - États : normal, focus, erreur, désactivé
 */

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;        // Message d'erreur (react-hook-form)
  hint?: string;         // Texte d'aide optionnel sous le champ
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, required, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
            {required && (
              <span className="text-danger-500 ml-1" aria-hidden="true">*</span>
            )}
          </label>
        )}

        {/* Wrapper pour icônes */}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={cn(
              // Base
              "w-full rounded-lg border bg-white text-gray-900 placeholder-gray-400",
              "text-sm transition-colors duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50",
              // Padding selon présence d'icônes
              leftIcon ? "pl-10" : "pl-3",
              rightIcon ? "pr-10" : "pr-3",
              "py-2.5",
              // État normal vs erreur
              error
                ? "border-danger-500 focus:ring-danger-500"
                : "border-gray-300 hover:border-gray-400",
              className
            )}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {/* Message d'erreur */}
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs text-danger-600"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Texte d'aide */}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
