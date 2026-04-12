"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Upload,
  FileText,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Statement {
  id: string;
  fileName: string;
  fileSize: number;
  status: string;
  processingStep: string | null;
  transactionCount: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const PROCESSING_STEPS = [
  { key: "reading", label: "Reading file" },
  { key: "extracting", label: "Extracting transactions" },
  { key: "matching", label: "Matching vendors" },
  { key: "categorizing", label: "Categorizing transactions" },
  { key: "saving", label: "Saving data" },
];

export default function UploadPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatements = useCallback(() => {
    fetch("/api/statements")
      .then((r) => r.json())
      .then(setStatements);
  }, []);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  useEffect(() => {
    const hasProcessing = statements.some(
      (s) => s.status === "processing" || s.status === "extracted"
    );
    if (!hasProcessing) return;
    const interval = setInterval(fetchStatements, 3000);
    return () => clearInterval(interval);
  }, [statements, fetchStatements]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".pdf")) {
        toast.error(`${file.name} is not a PDF`);
        continue;
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/statements/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const stmt = await res.json();
        toast.success(`Uploaded ${file.name}`);
        fetchStatements();
        fetch(`/api/statements/${stmt.id}/process`, { method: "POST" }).then(
          () => fetchStatements()
        );
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
      e.target.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/statements/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Statement deleted");
      fetchStatements();
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "categorized":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "processing":
      case "extracted":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const currentStepIndex = (stmt: Statement) => {
    if (stmt.status !== "processing" || !stmt.processingStep) return -1;
    return PROCESSING_STEPS.findIndex((s) => s.key === stmt.processingStep);
  };

  const statusContent = (stmt: Statement) => {
    if (stmt.status === "categorized") {
      return (
        <p className="text-xs text-muted-foreground">
          {stmt.transactionCount} transactions
        </p>
      );
    }

    if (stmt.status === "error") {
      return (
        <p className="text-xs text-red-600">{stmt.errorMessage ?? "Failed"}</p>
      );
    }

    if (stmt.status === "processing" && stmt.processingStep) {
      const stepIdx = currentStepIndex(stmt);
      return (
        <div className="mt-2 space-y-1">
          {PROCESSING_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2 text-xs">
              {i < stepIdx ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" />
              ) : i === stepIdx ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />
              )}
              <span
                className={
                  i <= stepIdx
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {step.label}
                {i === stepIdx && "..."}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return <p className="text-xs text-muted-foreground">Queued</p>;
  };

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <h1 className="text-base font-medium">Upload Statements</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
        <div
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium">
            Drop PDF files here or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Bank statements and credit card statements
          </p>
          <Button
            className="mt-4"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Choose Files"
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {statements.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Uploads</CardTitle>
                <Badge variant="secondary">
                  {statements.length} statement
                  {statements.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {statements.map((stmt) => (
                <div
                  key={stmt.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="mt-0.5">
                    {statusIcon(stmt.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {stmt.fileName}
                    </p>
                    {statusContent(stmt)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(stmt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Separator className="my-3" />
              <Link href="/transactions">
                <Button variant="outline" className="w-full">
                  View All Transactions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </>
  );
}
