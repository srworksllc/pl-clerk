export type TransactionType = "income" | "expense";
export type StatementStatus =
  | "uploaded"
  | "processing"
  | "extracted"
  | "categorized"
  | "error";
export type AccountType = "checking" | "savings" | "credit_card";
export type ReportType = "monthly_pl" | "quarterly_pl" | "annual_pl" | "custom";
