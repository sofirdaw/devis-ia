/**
 * Composant FormField — Regroupe Label + Input + message d'erreur
 * Élimine la répétition dans les formulaires
 * 
 * Usage :
 *   <FormField label="Nom" error={errors.name?.message}>
 *     <Input {...register("name")} />
 *   </FormField>
 */

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

export function FormField({ label, error, required, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {/* Message d'aide gris */}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {/* Message d'erreur rouge */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
