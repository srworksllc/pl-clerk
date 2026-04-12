// Schedule C line mappings for each category
export const CATEGORY_TAX_LINES: Record<string, string> = {
  "Sales & Service Revenue": "Line 1",
  "Returns & Refunds": "Line 2",
  "Other Income": "Line 6",
  "Materials & Supplies (COGS)": "Line 4 (COGS)",
  "Contract Labor (COGS)": "Line 4 (COGS)",
  "Advertising & Marketing": "Line 8",
  "Car & Truck": "Line 9",
  "Commissions & Processing Fees": "Line 10",
  "Contract Labor": "Line 11",
  "Insurance": "Line 15",
  "Interest": "Line 16b",
  "Legal & Professional": "Line 17",
  "Office Expenses": "Line 18",
  "Rent & Lease": "Line 20",
  "Repairs & Maintenance": "Line 21",
  "Supplies": "Line 22",
  "Taxes & Licenses": "Line 23",
  "Travel": "Line 24a",
  "Meals": "Line 24b",
  "Utilities": "Line 25",
  "Payroll & Wages": "Line 26",
  "Other": "Line 27",
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Car & Truck",
  "Commissions & Processing Fees",
  "Contract Labor",
  "Insurance",
  "Interest",
  "Legal & Professional",
  "Office Expenses",
  "Rent & Lease",
  "Repairs & Maintenance",
  "Supplies",
  "Taxes & Licenses",
  "Travel",
  "Meals",
  "Utilities",
  "Payroll & Wages",
  "Other",
] as const;

export const DEFAULT_COGS_CATEGORIES = [
  "Materials & Supplies (COGS)",
  "Contract Labor (COGS)",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales & Service Revenue",
  "Returns & Refunds",
  "Other Income",
] as const;

export const STATEMENT_STATUSES = [
  "uploaded",
  "processing",
  "extracted",
  "categorized",
  "error",
] as const;

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit_card",
] as const;

export const REPORT_TYPES = [
  "monthly_pl",
  "quarterly_pl",
  "annual_pl",
  "custom",
] as const;
