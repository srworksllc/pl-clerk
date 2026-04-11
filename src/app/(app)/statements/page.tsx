"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

interface Statement {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  transactionCount: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatements = useCallback(() => {
    fetch("/api/statements")
      .then((r) => r.json())
      .then(setStatements)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/statements/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const stmt = await res.json();
        toast.success(`Uploaded ${file.name}`);

        // Auto-process
        fetch(`/api/statements/${stmt.id}/process`, { method: "POST" })
          .then((r) => {
            if (r.ok) toast.success(`Processed ${file.name}`);
            else toast.error(`Failed to process ${file.name}`);
            fetchStatements();
          });
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    fetchStatements();
    e.target.value = "";
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/statements/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Statement deleted");
      fetchStatements();
    } else {
      toast.error("Failed to delete");
    }
  }

  async function handleProcess(id: string) {
    toast.info("Processing...");
    const res = await fetch(`/api/statements/${id}/process`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Statement processed");
      fetchStatements();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Processing failed");
    }
  }

  const statusColor: Record<string, string> = {
    uploaded: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    extracted: "bg-purple-100 text-purple-800",
    categorized: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Statements</h1>
        <div>
          <input
            type="file"
            accept=".pdf"
            multiple
            id="file-upload"
            className="hidden"
            onChange={handleUpload}
          />
          <Button disabled={uploading} onClick={() => document.getElementById("file-upload")?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload PDFs"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : statements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No statements yet. Upload a bank or credit card statement PDF to
              get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {statements.map((stmt) => (
            <Card key={stmt.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={`/statements/${stmt.id}`}
                      className="hover:underline"
                    >
                      {stmt.fileName}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {new Date(stmt.createdAt).toLocaleDateString()} &middot;{" "}
                    {(stmt.fileSize / 1024).toFixed(0)} KB
                    {stmt.transactionCount
                      ? ` · ${stmt.transactionCount} transactions`
                      : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColor[stmt.status] ?? ""}>
                    {stmt.status}
                  </Badge>
                  {stmt.status === "uploaded" && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleProcess(stmt.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(stmt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {stmt.errorMessage && (
                <CardContent>
                  <p className="text-sm text-red-600">{stmt.errorMessage}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
