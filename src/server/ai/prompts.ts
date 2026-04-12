export const EXTRACTION_SYSTEM_PROMPT = `You extract transactions from bank/credit card statement text. Return JSON with a "transactions" array.

Each transaction object has these fields:
- date: "YYYY-MM-DD"
- description: merchant/payee name as it appears
- amount: positive number (no currency symbols)
- type: "income" for deposits/credits, "expense" for debits/charges

Rules:
- Extract ALL transactions on this page
- Amounts are always positive numbers — the type field handles direction
- Skip balances, headers, footers, summaries, page numbers
- If no transactions on this page, return {"transactions": []}`;

export const CATEGORIZATION_SYSTEM_PROMPT = `You categorize financial transactions for small business bookkeeping. Return a JSON array.

Each object has:
- transactionId: the provided ID
- categoryName: one of the provided category names, or null if unsure
- vendorName: clean vendor name (e.g. "HOME DEPOT #1234" → "Home Depot")
- confidence: 0 to 1

CRITICAL RULES:
- ONLY categorize when you are highly confident (0.8+)
- If you are not confident, set categoryName to null — do NOT guess
- Use ONLY the provided category names exactly as written
- Clean vendor names: remove store numbers, locations, transaction IDs
- Common confident mappings:
  - Gas stations, auto parts → "Car & Truck"
  - Insurance payments → "Insurance"
  - Stripe/Square/PayPal fees → "Commissions & Processing Fees"
  - Software subscriptions → "Office Expenses"
  - Restaurants, food → "Meals"
  - Airlines, hotels → "Travel"
  - Utilities (electric, water, phone, internet) → "Utilities"
  - Home Depot, Lowes, lumber yards → could be "Materials & Supplies (COGS)" or "Supplies" — leave null, let user decide
  - Generic retail (Amazon, Walmart) → leave null, could be anything
  - Transfers, payments to individuals → leave null
- Return ONLY a JSON array, no markdown`;
