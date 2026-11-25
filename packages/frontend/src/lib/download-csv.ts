/** Saves rows as a CSV the browser downloads. Cells are quoted, so commas and line breaks survive. */
export function downloadCsv(filename: string, rows: readonly (readonly (string | number)[])[]): void {
  const body = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
