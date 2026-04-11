"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, BarChart3, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Report {
  id: string;
  name: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  data: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    transactionCount: number;
  };
  createdAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("monthly_pl");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  function fetchReports() {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setReports);
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function handleGenerate() {
    if (!name || !startDate || !endDate) {
      toast.error("Fill in all fields");
      return;
    }

    setGenerating(true);
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type,
        periodStart: startDate,
        periodEnd: endDate,
      }),
    });

    if (res.ok) {
      toast.success("Report generated");
      setName("");
      fetchReports();
    } else {
      toast.error("Failed to generate report");
    }
    setGenerating(false);
  }

  async function handleExport(id: string, format: "xlsx" | "csv") {
    const res = await fetch(`/api/reports/${id}/export?format=${format}`);
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Report deleted");
      if (selectedReport?.id === id) setSelectedReport(null);
      fetchReports();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Generate P&L Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q1 2026 P&L"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly_pl">Monthly</SelectItem>
                  <SelectItem value="quarterly_pl">Quarterly</SelectItem>
                  <SelectItem value="annual_pl">Annual</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={generating}>
                <BarChart3 className="mr-2 h-4 w-4" />
                {generating ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card
            key={report.id}
            className={`cursor-pointer transition-colors ${
              selectedReport?.id === report.id ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedReport(report)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">{report.name}</CardTitle>
                <CardDescription>
                  {new Date(report.periodStart).toLocaleDateString()} –{" "}
                  {new Date(report.periodEnd).toLocaleDateString()} &middot;{" "}
                  {report.data?.transactionCount ?? 0} transactions
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(report.id, "xlsx");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExport(report.id, "csv");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(report.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {selectedReport?.id === report.id && report.data && (
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">
                      Total Income
                    </p>
                    <p className="text-xl font-bold text-green-600">
                      $
                      {report.data.totalIncome.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">
                      Total Expenses
                    </p>
                    <p className="text-xl font-bold text-red-600">
                      $
                      {report.data.totalExpenses.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <p className="text-sm text-muted-foreground">Net Income</p>
                    <p
                      className={`text-xl font-bold ${
                        report.data.netIncome >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      $
                      {report.data.netIncome.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {report.data.incomeByCategory &&
                    Object.keys(report.data.incomeByCategory).length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2">Income Breakdown</h3>
                        <div className="space-y-1">
                          {Object.entries(report.data.incomeByCategory).map(
                            ([cat, amt]) => (
                              <div
                                key={cat}
                                className="flex justify-between text-sm"
                              >
                                <span>{cat}</span>
                                <span className="text-green-600">
                                  $
                                  {amt.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {report.data.expenseByCategory &&
                    Object.keys(report.data.expenseByCategory).length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2">Expense Breakdown</h3>
                        <div className="space-y-1">
                          {Object.entries(report.data.expenseByCategory).map(
                            ([cat, amt]) => (
                              <div
                                key={cat}
                                className="flex justify-between text-sm"
                              >
                                <span>{cat}</span>
                                <span className="text-red-600">
                                  $
                                  {amt.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
