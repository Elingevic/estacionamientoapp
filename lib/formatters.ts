/**
 * Funciones de formateo estándar venezolanas (punto para miles, coma para decimales)
 */

export function formatNumberVE(amount: number | string, decimals: number = 2): string {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(num)) return "0,00";
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatBs(amount: number | string): string {
  return `Bs. ${formatNumberVE(amount, 2)}`;
}

export function formatUsd(amount: number | string): string {
  return `$${formatNumberVE(amount, 2)}`;
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
