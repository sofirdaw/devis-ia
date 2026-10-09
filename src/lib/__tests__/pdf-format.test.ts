import { describe, expect, it } from "vitest";
import { amountInCfaWords, getDocumentSubject } from "../pdf-format";

describe("PDF formatting helpers", () => {
  it.each([
    [0, "zéro franc CFA"],
    [1, "un franc CFA"],
    [21, "vingt et un francs CFA"],
    [71, "soixante et onze francs CFA"],
    [80, "quatre-vingts francs CFA"],
    [2360000, "deux millions trois cent soixante mille francs CFA"],
  ])("spells %i FCFA correctly", (amount, expected) => {
    expect(amountInCfaWords(amount)).toBe(expected);
  });

  it("creates a concise object from unique document line items", () => {
    expect(getDocumentSubject(["Ordinateur", "Imprimante", "Ordinateur"])).toBe(
      "Ordinateur, Imprimante"
    );
    expect(getDocumentSubject([])).toContain("prestations de services");
  });
});
