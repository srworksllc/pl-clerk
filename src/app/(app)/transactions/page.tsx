"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
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
  vendor?: { id: string; name: string } | null;
}

interface VendorGroup {
  name: string;
  transactions: Transaction[];
  total: number;
}

export default function TransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/transactions/stats").then((r) => r.json()),
    ]).then(([txns, cats, stats]) => {
      setAllTransactions(txns);
      setCategories(cats);
      setUncategorizedCount(stats.uncategorized ?? 0);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCategoryChange(txnId: string, categoryId: string) {
    const res = await fetch(`/api/transactions/${txnId}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });

    if (res.ok) {
      const cat = categories.find((c) => c.id === categoryId);
      setAllTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId ? { ...t, categoryId, category: cat ?? null } : t
        )
      );
      setUncategorizedCount((c) => Math.max(0, c - 1));
      toast.success("Category updated");
    } else {
      toast.error("Failed to update category");
    }
  }

  async function handleBatchCategorize(vendorName: string, categoryId: string) {
    const res = await fetch("/api/transactions/batch-categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorName, categoryId }),
    });

    if (res.ok) {
      const { count } = await res.json();
      const cat = categories.find((c) => c.id === categoryId);

      // Optimistically update all matching transactions
      setAllTransactions((prev) =>
        prev.map((t) =>
          (t.vendor?.name ?? "Unknown") === vendorName && !t.categoryId
            ? { ...t, categoryId, category: cat ?? null }
            : t
        )
      );
      setUncategorizedCount((c) => Math.max(0, c - count));
      toast.success(`Categorized ${count} transactions from ${vendorName}`);
    } else {
      toast.error("Failed to categorize");
    }
  }

  const filtered = search
    ? allTransactions.filter(
        (t) =>
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.vendor?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : allTransactions;

  const uncategorized = filtered.filter((t) => !t.categoryId);

  // Group uncategorized by vendor
  const uncatVendorGroups: VendorGroup[] = [];
  const uncatVendorMap = new Map<string, VendorGroup>();
  for (const txn of uncategorized) {
    const name = txn.vendor?.name ?? "Unknown";
    let group = uncatVendorMap.get(name);
    if (!group) {
      group = { name, transactions: [], total: 0 };
      uncatVendorMap.set(name, group);
      uncatVendorGroups.push(group);
    }
    group.transactions.push(txn);
    group.total += parseFloat(txn.amount);
  }
  uncatVendorGroups.sort((a, b) => b.transactions.length - a.transactions.length);

  // Split into multi-transaction vendors and one-offs
  const multiVendors = uncatVendorGroups.filter((g) => g.transactions.length > 1);
  const oneOffs = uncatVendorGroups
    .filter((g) => g.transactions.length === 1)
    .flatMap((g) => g.transactions);

  // Group all transactions by vendor for "By Vendor" tab
  const allVendorGroups: VendorGroup[] = [];
  const allVendorMap = new Map<string, VendorGroup>();
  for (const txn of filtered) {
    const name = txn.vendor?.name ?? "Unknown";
    let group = allVendorMap.get(name);
    if (!group) {
      group = { name, transactions: [], total: 0 };
      allVendorMap.set(name, group);
      allVendorGroups.push(group);
    }
    group.transactions.push(txn);
    group.total += parseFloat(txn.amount);
  }
  allVendorGroups.sort((a, b) => b.total - a.total);

  function fmt(n: number): string {
    return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  }

  function TransactionRow({ txn }: { txn: Transaction }) {
    return (
      <TableRow>
        <TableCell className="whitespace-nowrap">
          {new Date(txn.date).toLocaleDateString()}
        </TableCell>
        <TableCell className="max-w-[200px] truncate">
          {txn.description}
        </TableCell>
        <TableCell>{txn.vendor?.name ?? "—"}</TableCell>
        <TableCell>
          <Select
            value={txn.categoryId ?? ""}
            onValueChange={(val) => val && handleCategoryChange(txn.id, val)}
          >
            <SelectTrigger>
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
          className={`text-right font-medium tabular-nums whitespace-nowrap ${
            txn.type === "income" ? "text-green-600" : "text-red-600"
          }`}
        >
          {txn.type === "income" ? "+" : "-"}${fmt(parseFloat(txn.amount))}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">Transactions</h1>
          <div className="ml-auto">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Tabs defaultValue={uncategorizedCount > 0 ? "uncategorized" : "all"}>
              <TabsList>
                <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
                <TabsTrigger value="uncategorized">
                  Uncategorized
                  {uncategorizedCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {uncategorizedCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="vendors">By Vendor</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <Card>
                  {filtered.length === 0 ? (
                    <CardHeader>
                      <CardDescription>No transactions found.</CardDescription>
                    </CardHeader>
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
                          <TransactionRow key={txn.id} txn={txn} />
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="uncategorized">
                <div className="space-y-4">
                  {uncategorized.length === 0 ? (
                    <Card>
                      <CardHeader>
                        <CardDescription>
                          All transactions are categorized.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ) : (
                    <>
                      {/* Vendors with multiple transactions — batch categorize */}
                      {multiVendors.map((group) => (
                        <Card key={group.name}>
                          <Collapsible>
                            <CardHeader>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <CollapsibleTrigger className="flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                                  </CollapsibleTrigger>
                                  <div>
                                    <CardTitle className="text-base">
                                      {group.name}
                                    </CardTitle>
                                    <CardDescription>
                                      {group.transactions.length} transactions
                                      &middot; ${fmt(group.total)}
                                    </CardDescription>
                                  </div>
                                </div>
                                <Select
                                  onValueChange={(val) =>
                                    val &&
                                    handleBatchCategorize(group.name, val)
                                  }
                                >
                                  <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Categorize all as..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardHeader>
                            <CollapsibleContent>
                              <Table>
                                <TableBody>
                                  {group.transactions.map((txn) => (
                                    <TableRow key={txn.id}>
                                      <TableCell className="whitespace-nowrap">
                                        {new Date(
                                          txn.date
                                        ).toLocaleDateString()}
                                      </TableCell>
                                      <TableCell className="truncate">
                                        {txn.description}
                                      </TableCell>
                                      <TableCell
                                        className={`text-right tabular-nums whitespace-nowrap ${
                                          txn.type === "income"
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {txn.type === "income" ? "+" : "-"}$
                                        {fmt(parseFloat(txn.amount))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))}

                      {/* One-off transactions — individual categorize */}
                      {oneOffs.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              One-off transactions
                            </CardTitle>
                            <CardDescription>
                              {oneOffs.length} transactions without a recurring
                              vendor
                            </CardDescription>
                          </CardHeader>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">
                                  Amount
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {oneOffs.map((txn) => (
                                <TableRow key={txn.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(txn.date).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="truncate">
                                    {txn.description}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      onValueChange={(val) =>
                                        val &&
                                        handleCategoryChange(txn.id, val)
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categories.map((cat) => (
                                          <SelectItem
                                            key={cat.id}
                                            value={cat.id}
                                          >
                                            {cat.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell
                                    className={`text-right tabular-nums whitespace-nowrap ${
                                      txn.type === "income"
                                        ? "text-green-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {txn.type === "income" ? "+" : "-"}$
                                    {fmt(parseFloat(txn.amount))}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="vendors">
                <div className="space-y-4">
                  {allVendorGroups.map((group) => (
                    <Card key={group.name}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {group.name}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm tabular-nums">
                            <span className="text-red-600">
                              ${fmt(group.total)}
                            </span>
                            <Badge variant="secondary">
                              {group.transactions.length}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </>
  );
}
