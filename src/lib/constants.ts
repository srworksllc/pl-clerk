export const DEFAULT_EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Bank Fees & Interest",
  "Contract Labor",
  "Dues & Subscriptions",
  "Equipment & Tools",
  "Fuel & Auto",
  "Insurance",
  "Legal & Professional",
  "Meals & Entertainment",
  "Office Supplies",
  "Payroll",
  "Rent & Lease",
  "Repairs & Maintenance",
  "Shipping & Postage",
  "Software & Technology",
  "Taxes & Licenses",
  "Travel",
  "Utilities",
  "Miscellaneous",
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  "Sales Revenue",
  "Service Revenue",
  "Interest Income",
  "Refunds & Reimbursements",
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
