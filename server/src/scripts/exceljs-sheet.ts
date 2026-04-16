import ExcelJS from "exceljs";
import type { ControlePrazosRawRow } from "./import-controle-prazos-lib";

type RawCell = string | number | boolean | Date | null | undefined;

function normalizeCellValue(value: ExcelJS.CellValue): RawCell {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCellValue(item as ExcelJS.CellValue)).join(" ");
  }

  if (typeof value === "object") {
    if ("result" in value) {
      return normalizeCellValue(value.result as ExcelJS.CellValue);
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return typeof value.text === "string" && value.text.trim()
        ? value.text
        : value.hyperlink;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text ?? "").join("");
    }
  }

  return String(value);
}

export async function readControlePrazosSheet(
  filePath: string,
  sheetName: string,
) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Aba nao encontrada: ${sheetName}`);
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues.map((value: ExcelJS.CellValue) =>
    String(normalizeCellValue(value) ?? "").trim(),
  );

  const rows: ControlePrazosRawRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const parsedRow: Record<string, RawCell> = {};
    headers.forEach((header: string, index: number) => {
      if (!header) {
        return;
      }

      parsedRow[header] = normalizeCellValue(row.getCell(index + 1).value);
    });

    const hasValue = Object.values(parsedRow).some(
      (value) => value !== null && value !== undefined && String(value).trim() !== "",
    );

    if (hasValue) {
      rows.push(parsedRow as ControlePrazosRawRow);
    }
  });

  return rows;
}
