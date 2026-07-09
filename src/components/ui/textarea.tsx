/**
 * Composant Textarea — Zone de texte multi-lignes
 * Même API que Input (label, error, hint)
 */

import { cn } from "@/lib/utils";
import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, required, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
            {required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400",
            "text-sm px-3 py-2.5 transition-colors duration-200 resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger-500 focus:ring-danger-500",
            className
          )}
          {...props}
        />

        {error && <p className="mt-1.5 text-xs text-danger-600" role="alert">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
