import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, cn } from "../utils";

describe("Utils & Calculs", () => {
  it("formate correctement la monnaie en FCFA", () => {
    const formatted = formatCurrency(50000);
    expect(formatted).toContain("50");
    expect(formatted).toContain("000");
    expect(formatted).toContain("CFA");
  });

  it("formate 0 FCFA", () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain("0");
    expect(formatted).toContain("CFA");
  });

  it("formate une date ISO correctement", () => {
    const formatted = formatDate("2026-08-23");
    expect(formatted).toBeDefined();
    expect(formatted.length).toBeGreaterThan(0);
  });

  it("gère les classes CSS conditionnelles avec cn()", () => {
    const classes = cn("base-class", true && "active", false && "hidden", { "text-red-500": true });
    expect(classes).toContain("base-class");
    expect(classes).toContain("active");
    expect(classes).not.toContain("hidden");
    expect(classes).toContain("text-red-500");
  });
});
