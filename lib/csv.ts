// Minimal CSV builder. Quotes any field containing a comma, quote, or
// newline; doubles inner quotes. Prepends a UTF-8 BOM so Excel detects
// the encoding (names, ₹ amounts, etc.).

export type CsvValue = string | number | boolean | null | undefined;

const BOM = "﻿";

function escapeField(v: CsvValue): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeField).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
