"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

interface StatementDetail {
  id: string;
  fileName: string;
  status: string;
  transactionCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  transactions: Transaction[];
}

export default function StatementDetailPage() {
  const params = useParams();
  const [data, setData] = useState<StatementDetail | null>(null);

  useEffect(() => {
    fetch(`/api/statements/${params.id}`)
      .then((r) => r.json())
      .then(setData);
  }, [params.id]);

  if (!data) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/statements">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{data.fileName}</h1>
          <p className="text-sm text-muted-foreground">
            {data.periodStart && data.periodEnd
              ? `${new Date(data.periodStart).toLocaleDateString()} – ${new Date(data.periodEnd).toLocaleDateString()}`
              : "Period not detected"}{" "}
            &middot; <Badge>{data.status}</Badge>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {data.transactions.length} transactions extracted
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No transactions extracted yet.
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
                {data.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{txn.description}</TableCell>
                    <TableCell>{txn.vendor?.name ?? "—"}</TableCell>
                    <TableCell>
                      {txn.category?.name ?? (
                        <span className="text-muted-foreground">
                          Uncategorized
                        </span>
                      )}
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
