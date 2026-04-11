"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  categoryId: string | null;
  category?: { id: string; name: string } | null;
  vendor?: { name: string } | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([txns, cats]) => {
      setTransactions(txns);
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  async function handleCategoryChange(txnId: string, categoryId: string) {
    const res = await fetch(`/api/transactions/${txnId}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });

    if (res.ok) {
      const cat = categories.find((c) => c.id === categoryId);
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? { ...t, categoryId, category: cat ?? null }
            : t
        )
      );
      toast.success("Category updated");
    } else {
      toast.error("Failed to update category");
    }
  }

  const filtered = search
    ? transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.vendor?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : transactions;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Transactions</h1>

      <div className="flex gap-4">
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-muted-foreground text-sm">
              No transactions found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>{txn.vendor?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={txn.categoryId ?? ""}
                        onValueChange={(val) =>
                          val && handleCategoryChange(txn.id, val)
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        txn.type === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}$
                      {parseFloat(txn.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
