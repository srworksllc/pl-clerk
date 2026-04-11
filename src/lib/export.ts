import * as XLSX from "xlsx";

interface ReportData {
  periodStart?: string;
  periodEnd?: string;
  totalIncome?: number;
  totalExpenses?: number;
  netIncome?: number;
  incomeByCategory?: Record<string, number>;
  expenseByCategory?: Record<string, number>;
  transactionCount?: number;
}

export async function generateExcel(
  data: Record<string, unknown>
): Promise<Buffer> {
  const report = data as ReportData;
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["P&L Report"],
    ["Period", `${report.periodStart} to ${report.periodEnd}`],
    [],
    ["Total Income", report.totalIncome ?? 0],
    ["Total Expenses", report.totalExpenses ?? 0],
    ["Net Income", report.netIncome ?? 0],
    ["Transaction Count", report.transactionCount ?? 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Income breakdown
  if (report.incomeByCategory) {
    const incomeData = [
      ["Category", "Amount"],
      ...Object.entries(report.incomeByCategory).map(([cat, amt]) => [
        cat,
        amt,
      ]),
    ];
    const incomeSheet = XLSX.utils.aoa_to_sheet(incomeData);
    XLSX.utils.book_append_sheet(wb, incomeSheet, "Income");
  }

  // Expense breakdown
  if (report.expenseByCategory) {
    const expenseData = [
      ["Category", "Amount"],
      ...Object.entries(report.expenseByCategory).map(([cat, amt]) => [
        cat,
        amt,
      ]),
    ];
    const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, expenseSheet, "Expenses");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

export function generateCsv(data: Record<string, unknown>): string {
  const report = data as ReportData;
  const lines: string[] = [];

  lines.push("P&L Report");
  lines.push(`Period,${report.periodStart} to ${report.periodEnd}`);
  lines.push("");
  lines.push(`Total Income,${report.totalIncome ?? 0}`);
  lines.push(`Total Expenses,${report.totalExpenses ?? 0}`);
  lines.push(`Net Income,${report.netIncome ?? 0}`);
  lines.push("");

  if (report.incomeByCategory) {
    lines.push("Income by Category");
    lines.push("Category,Amount");
    for (const [cat, amt] of Object.entries(report.incomeByCategory)) {
      lines.push(`"${cat}",${amt}`);
    }
    lines.push("");
  }

  if (report.expenseByCategory) {
    lines.push("Expenses by Category");
    lines.push("Category,Amount");
    for (const [cat, amt] of Object.entries(report.expenseByCategory)) {
      lines.push(`"${cat}",${amt}`);
    }
  }

  return lines.join("\n");
}
