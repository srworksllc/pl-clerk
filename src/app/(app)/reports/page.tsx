"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";

interface PLData {
  periodStart: string;
  periodEnd: string;
  incomeByCategory: Record<string, number>;
  cogsByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  totalIncome: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
  uncategorizedCount: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function getDefaults() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return {
    start: startOfYear.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const defaults = getDefaults();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);

  function fetchPL(start: string, end: string) {
    setLoading(true);
    fetch(`/api/reports/live?startDate=${start}&endDate=${end}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPL(startDate, endDate);
  }, [startDate, endDate]);

  function setQuickRange(label: string) {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (label) {
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), q, 1);
        break;
      }
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "last-year":
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }

  async function handleExport(format: "xlsx" | "csv") {
    const res = await fetch(
      `/api/reports/export?startDate=${startDate}&endDate=${endDate}&format=${format}`
    );
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PL-${startDate}-to-${endDate}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  }

  async function handleShare() {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `P&L ${startDate} to ${endDate}`,
        expiresInDays: 30,
      }),
    });

    if (res.ok) {
      const share = await res.json();
      const url = `${window.location.origin}/share/${share.token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } else {
      toast.error("Failed to create share link");
    }
  }

  const incomeEntries = data
    ? Object.entries(data.incomeByCategory).sort((a, b) => b[1] - a[1])
    : [];
  const cogsEntries = data
    ? Object.entries(data.cogsByCategory).sort((a, b) => b[1] - a[1])
    : [];
  const expenseEntries = data
    ? Object.entries(data.expenseByCategory).sort((a, b) => b[1] - a[1])
    : [];
  const hasCogs = cogsEntries.length > 0;

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">P&L Report</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Separator
                orientation="vertical"
                className="data-[orientation=vertical]:h-10"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuickRange("month")}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange("quarter")}>
                  This Quarter
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange("year")}>
                  This Year
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange("last-year")}>
                  Last Year
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : data && data.transactionCount > 0 ? (
            <>
              {data.uncategorizedCount > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="destructive">{data.uncategorizedCount}</Badge>
                      <span className="text-muted-foreground">
                        uncategorized transactions — categorize them for an accurate P&L
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardDescription>Total Income</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      ${fmt(data.totalIncome)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Total Expenses</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">
                      ${fmt(data.totalCogs + data.totalExpenses)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Net Profit</CardDescription>
                    <CardTitle
                      className={`text-2xl font-semibold tabular-nums ${
                        data.netProfit < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {data.netProfit < 0 ? "-" : ""}${fmt(Math.abs(data.netProfit))}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Income Section */}
              {incomeEntries.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardDescription>Income</CardDescription>
                      <span className="text-sm font-semibold tabular-nums">
                        ${fmt(data.totalIncome)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {incomeEntries.map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <span className="tabular-nums">${fmt(amt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* COGS Section (only if used) */}
              {hasCogs && (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardDescription>Cost of Goods Sold</CardDescription>
                        <span className="text-sm font-semibold tabular-nums">
                          ${fmt(data.totalCogs)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {cogsEntries.map(([cat, amt]) => (
                          <div key={cat} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{cat}</span>
                            <span className="tabular-nums">${fmt(amt)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardDescription>Gross Profit</CardDescription>
                        <CardTitle className="text-xl font-semibold tabular-nums">
                          ${fmt(data.grossProfit)}
                        </CardTitle>
                      </div>
                    </CardHeader>
                  </Card>
                </>
              )}

              {/* Expenses Section */}
              {expenseEntries.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardDescription>Expenses</CardDescription>
                      <span className="text-sm font-semibold tabular-nums">
                        ${fmt(data.totalExpenses)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {expenseEntries.map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <span className="tabular-nums">${fmt(amt)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Net Profit */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Net Profit</CardTitle>
                    <CardTitle
                      className={`text-2xl font-semibold tabular-nums ${
                        data.netProfit < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {data.netProfit < 0 ? "-" : ""}${fmt(Math.abs(data.netProfit))}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    {data.transactionCount} transactions
                  </CardDescription>
                </CardHeader>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleExport("xlsx")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={() => handleExport("csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share with Accountant
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No transactions in this date range. Upload statements to see
                  your P&L.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
