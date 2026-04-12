import { db } from "./index";
import { categories } from "./schema";
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_COGS_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  CATEGORY_TAX_LINES,
} from "@/lib/constants";

export async function seedCategories(userId: string) {
  const incomeRows = DEFAULT_INCOME_CATEGORIES.map((name, i) => ({
    userId,
    name,
    type: "income" as const,
    taxLine: CATEGORY_TAX_LINES[name] ?? null,
    isDefault: true,
    sortOrder: i,
  }));

  const cogsRows = DEFAULT_COGS_CATEGORIES.map((name, i) => ({
    userId,
    name,
    type: "cogs" as const,
    taxLine: CATEGORY_TAX_LINES[name] ?? null,
    isDefault: true,
    sortOrder: i,
  }));

  const expenseRows = DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
    userId,
    name,
    type: "expense" as const,
    taxLine: CATEGORY_TAX_LINES[name] ?? null,
    isDefault: true,
    sortOrder: i,
  }));

  await db
    .insert(categories)
    .values([...incomeRows, ...cogsRows, ...expenseRows]);
}
