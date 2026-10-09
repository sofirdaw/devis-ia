const units = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

function underHundred(value: number): string {
  if (value <= 16) return units[value];
  if (value < 20) return `dix-${units[value - 10]}`;
  if (value < 70) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    const label = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"][tens];
    if (remainder === 0) return label;
    if (remainder === 1) return `${label} et un`;
    return `${label}-${units[remainder]}`;
  }
  if (value < 80) {
    const remainder = value - 60;
    return remainder === 11 ? "soixante et onze" : `soixante-${underHundred(remainder)}`;
  }
  const remainder = value - 80;
  if (remainder === 0) return "quatre-vingts";
  return `quatre-vingt-${underHundred(remainder)}`;
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value);
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const label = hundreds === 1 ? "cent" : `${units[hundreds]} cent`;
  if (remainder === 0) return hundreds > 1 ? `${label}s` : label;
  return `${label} ${underHundred(remainder)}`;
}

function integerToFrench(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Le montant doit être un entier positif.");
  }
  if (value < 1000) return underThousand(value);

  const millions = Math.floor(value / 1_000_000);
  const afterMillions = value % 1_000_000;
  if (millions > 0) {
    const millionLabel = millions === 1 ? "un million" : `${integerToFrench(millions)} millions`;
    return afterMillions ? `${millionLabel} ${integerToFrench(afterMillions)}` : millionLabel;
  }

  const thousands = Math.floor(value / 1000);
  const remainder = value % 1000;
  const thousandLabel = thousands === 1 ? "mille" : `${underThousand(thousands)} mille`;
  return remainder ? `${thousandLabel} ${underThousand(remainder)}` : thousandLabel;
}

export function amountInCfaWords(amount: number): string {
  const roundedAmount = Math.round(amount);
  const words = integerToFrench(roundedAmount);
  return `${words} franc${roundedAmount > 1 ? "s" : ""} CFA`;
}

export function getDocumentSubject(designations: string[]): string {
  const uniqueItems = [...new Set(designations.map((name) => name.trim()).filter(Boolean))];
  if (uniqueItems.length === 0) return "Fourniture de biens et/ou prestations de services";
  const subject = uniqueItems.slice(0, 3).join(", ");
  return uniqueItems.length > 3 ? `${subject} et autres articles` : subject;
}
