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
    <div className="min-h-screen bg-muted p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">P&L Clerk — Shared View</h1>
          <p className="text-muted-foreground">Read-only access</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Income</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                ${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Net Income</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${(totalIncome - totalExpenses).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              {data.transactions.length} transactions
            </CardDescription>
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
                      className={`text-right font-medium ${
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
