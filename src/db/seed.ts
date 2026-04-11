import { db } from "./index";
import { categories } from "./schema";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "@/lib/constants";

export async function seedCategories(userId: string) {
  const expenseRows = DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({
    userId,
    name,
    type: "expense" as const,
    isDefault: true,
    sortOrder: i,
  }));

  const incomeRows = DEFAULT_INCOME_CATEGORIES.map((name, i) => ({
    userId,
    name,
    type: "income" as const,
    isDefault: true,
    sortOrder: i,
  }));

  await db.insert(categories).values([...expenseRows, ...incomeRows]);
}
