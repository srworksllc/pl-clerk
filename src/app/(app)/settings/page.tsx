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
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";

interface Share {
  id: string;
  token: string;
  label: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [shares, setShares] = useState<Share[]>([]);
  const [shareLabel, setShareLabel] = useState("");
  const [shareDays, setShareDays] = useState("30");

  function fetchShares() {
    fetch("/api/share")
      .then((r) => r.json())
      .then(setShares);
  }

  useEffect(() => {
    fetchShares();
  }, []);

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
    } else {
      toast.error("Failed to create share link");
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Accountant Access</CardTitle>
          <CardDescription>
            Create read-only links to share your financial data with your CPA or
            accountant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label>Label (optional)</Label>
              <Input
                value={shareLabel}
                onChange={(e) => setShareLabel(e.target.value)}
                placeholder="For my CPA"
              />
            </div>
            <div className="space-y-2 w-32">
              <Label>Expires in (days)</Label>
              <Input
                type="number"
                value={shareDays}
                onChange={(e) => setShareDays(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateShare}>Create Link</Button>
            </div>
          </div>

          {shares.length > 0 && (
            <div className="space-y-2 mt-4">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {share.label ?? "Shared link"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(share.createdAt).toLocaleDateString()}
                      {share.expiresAt &&
                        ` · Expires ${new Date(share.expiresAt).toLocaleDateString()}`}
                      {!share.isActive && " · Revoked"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {share.isActive && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
