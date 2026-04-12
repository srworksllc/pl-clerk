"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Trash2, Plus, Copy } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  isDefault: boolean;
}

interface Share {
  id: string;
  token: string;
  label: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">("expense");
  const [shareLabel, setShareLabel] = useState("");
  const [shareDays, setShareDays] = useState("30");

  function fetchCategories() {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
  }

  function fetchShares() {
    fetch("/api/share")
      .then((r) => r.json())
      .then(setShares);
  }

  useEffect(() => {
    fetchCategories();
    fetchShares();
  }, []);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), type: newCatType }),
    });
    if (res.ok) {
      toast.success("Category added");
      setNewCatName("");
      fetchCategories();
    }
  }

  async function handleDeleteCategory(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Category deleted");
      fetchCategories();
    }
  }

  async function handleCreateShare() {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: shareLabel || undefined,
        expiresInDays: parseInt(shareDays) || undefined,
      }),
    });
    if (res.ok) {
      toast.success("Share link created");
      setShareLabel("");
      fetchShares();
    }
  }

  async function handleRevokeShare(id: string) {
    const res = await fetch(`/api/share/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Share link revoked");
      fetchShares();
    }
  }

  function copyShareUrl(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <h1 className="text-base font-medium">Settings</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="sharing">Sharing</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Category name"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddCategory()
                      }
                      className="max-w-xs"
                    />
                    <Select
                      value={newCatType}
                      onValueChange={(v) =>
                        v && setNewCatType(v as "income" | "expense")
                      }
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddCategory}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Expense Categories</CardTitle>
                      <Badge variant="secondary">
                        {expenseCategories.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {expenseCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between rounded-lg border p-2.5"
                      >
                        <span className="text-sm">{cat.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Income Categories</CardTitle>
                      <Badge variant="secondary">
                        {incomeCategories.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {incomeCategories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between rounded-lg border p-2.5"
                      >
                        <span className="text-sm">{cat.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sharing">
            <Card>
              <CardHeader>
                <CardTitle>Accountant Access</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Create read-only links to share your financial data.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                    placeholder="Label (e.g. For my CPA)"
                    className="max-w-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap text-sm">
                      Expires in
                    </Label>
                    <Input
                      type="number"
                      value={shareDays}
                      onChange={(e) => setShareDays(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <Button onClick={handleCreateShare}>Create Link</Button>
                </div>

                {shares.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      {shares.map((share) => (
                        <div
                          key={share.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {share.label ?? "Shared link"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created{" "}
                              {new Date(share.createdAt).toLocaleDateString()}
                              {share.expiresAt &&
                                ` · Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                              {!share.isActive && " · Revoked"}
                            </p>
                          </div>
                          {share.isActive && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyShareUrl(share.token)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRevokeShare(share.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Account settings coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </>
  );
}
