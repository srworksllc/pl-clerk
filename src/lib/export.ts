import * as XLSX from "xlsx";

interface PLData {
  periodStart?: string;
  periodEnd?: string;
  incomeByCategory?: Record<string, number>;
  cogsByCategory?: Record<string, number>;
  expenseByCategory?: Record<string, number>;
  totalIncome?: number;
  totalCogs?: number;
  grossProfit?: number;
  totalExpenses?: number;
  netProfit?: number;
  transactionCount?: number;
  uncategorizedCount?: number;
}

function sortedEntries(obj: Record<string, number> | undefined): [string, number][] {
  if (!obj) return [];
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

export async function generateExcel(
  data: Record<string, unknown>
): Promise<Buffer> {
  const report = data as PLData;
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    ["Profit & Loss Statement"],
    ["Period", `${report.periodStart} to ${report.periodEnd}`],
    [],
    ["INCOME"],
    ["Category", "Amount"],
  ];

  for (const [cat, amt] of sortedEntries(report.incomeByCategory)) {
    rows.push([cat, amt]);
  }
  rows.push(["TOTAL INCOME", report.totalIncome ?? 0]);
  rows.push([]);

  const cogsEntries = sortedEntries(report.cogsByCategory);
  if (cogsEntries.length > 0) {
    rows.push(["COST OF GOODS SOLD"]);
    rows.push(["Category", "Amount"]);
    for (const [cat, amt] of cogsEntries) {
      rows.push([cat, amt]);
    }
    rows.push(["TOTAL COGS", report.totalCogs ?? 0]);
    rows.push([]);
    rows.push(["GROSS PROFIT", report.grossProfit ?? 0]);
    rows.push([]);
  }

  rows.push(["EXPENSES"]);
  rows.push(["Category", "Amount"]);
  for (const [cat, amt] of sortedEntries(report.expenseByCategory)) {
    rows.push([cat, amt]);
  }
  rows.push(["TOTAL EXPENSES", report.totalExpenses ?? 0]);
  rows.push([]);
  rows.push(["NET PROFIT", report.netProfit ?? 0]);
  rows.push([]);
  rows.push(["Transaction Count", report.transactionCount ?? 0]);
  if ((report.uncategorizedCount ?? 0) > 0) {
    rows.push(["Uncategorized Transactions", report.uncategorizedCount ?? 0]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "P&L");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

export function generateCsv(data: Record<string, unknown>): string {
  const report = data as PLData;
  const lines: string[] = [];

  lines.push("Profit & Loss Statement");
  lines.push(`Period,${report.periodStart} to ${report.periodEnd}`);
  lines.push("");
  lines.push("INCOME");
  lines.push("Category,Amount");
  for (const [cat, amt] of sortedEntries(report.incomeByCategory)) {
    lines.push(`"${cat}",${amt}`);
  }
  lines.push(`TOTAL INCOME,${report.totalIncome ?? 0}`);
  lines.push("");

  const cogsEntries = sortedEntries(report.cogsByCategory);
  if (cogsEntries.length > 0) {
    lines.push("COST OF GOODS SOLD");
    lines.push("Category,Amount");
    for (const [cat, amt] of cogsEntries) {
      lines.push(`"${cat}",${amt}`);
    }
    lines.push(`TOTAL COGS,${report.totalCogs ?? 0}`);
    lines.push("");
    lines.push(`GROSS PROFIT,${report.grossProfit ?? 0}`);
    lines.push("");
  }

  lines.push("EXPENSES");
  lines.push("Category,Amount");
  for (const [cat, amt] of sortedEntries(report.expenseByCategory)) {
    lines.push(`"${cat}",${amt}`);
  }
  lines.push(`TOTAL EXPENSES,${report.totalExpenses ?? 0}`);
  lines.push("");
  lines.push(`NET PROFIT,${report.netProfit ?? 0}`);

  return lines.join("\n");
}
