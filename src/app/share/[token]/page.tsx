"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
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

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  category?: { name: string } | null;
  vendor?: { name: string } | null;
}

interface ShareData {
  transactions: Transaction[];
  categories: { id: string; name: string; type: string }[];
}

export default function SharedViewPage() {
  const params = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/${params.token}/data`)
      .then((r) => {
        if (!r.ok) throw new Error("Link expired or invalid");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params.token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const totalIncome = data.transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpenses = data.transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-4 md:gap-6">
        <div>
          <h1 className="text-base font-medium">P&L Clerk — Shared View</h1>
          <p className="text-sm text-muted-foreground">Read-only access</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Income</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-green-600">
                ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Expenses</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-red-600">
                ${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Net Income</CardDescription>
              <CardTitle className={`text-2xl font-semibold tabular-nums ${totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${(totalIncome - totalExpenses).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardDescription>All Transactions</CardDescription>
            <CardTitle className="text-base">
              {data.transactions.length} transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                {data.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {new Date(txn.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>{txn.vendor?.name ?? "—"}</TableCell>
                    <TableCell>{txn.category?.name ?? "Uncategorized"}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        txn.type === "income" ? "text-green-600" : "text-red-600"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
