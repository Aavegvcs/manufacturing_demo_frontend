"use client";

import { Box, Download, Mail } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button, Typography } from "@/components/ui";
import { useProductSectionContent } from "@/features/catalog";
import { type CadViewerHandle, CadViewer } from "./cad-viewer";

/** Shape persisted by the backend under `product.sections.cad_preview`. */
interface CadDownload {
  label: string;
  url: string;
  ext: string;
}
interface CadPreviewContent {
  modelName?: string;
  viewerUrl?: string | null;
  viewerFormat?: string | null;
  downloads?: CadDownload[];
}

interface CadViewerPanelProps {
  productId: string;
}

// Bundled demo asset, used when the product has no backend CAD model yet.
const FALLBACK_MODEL_URL = "/models/nova-r-grille.json";
const FALLBACK_DXF_URL = "/models/nova-r-grille.dxf";
const FALLBACK_NAME = "Systemair NOVA-R Linear Grille";

/** Colour chip per file type, keyed by extension/label. */
function badgeColor(label: string, ext = ""): string {
  const k = `${label} ${ext}`.toLowerCase();
  if (k.includes("stl")) return "text-purple-600 bg-purple-50";
  if (k.includes("step") || k.includes("stp"))
    return "text-blue-600 bg-blue-50";
  if (k.includes("iges") || k.includes("igs"))
    return "text-emerald-600 bg-emerald-50";
  if (k.includes("dxf") || k.includes("dwg"))
    return "text-amber-600 bg-amber-50";
  if (k.includes("pdf")) return "text-red-600 bg-red-50";
  return "text-slate-600 bg-slate-100";
}

/**
 * 3D CAD Model tab. Reads the product's `cad_preview` section from the backend
 * (viewer mesh URL + download files) and renders the interactive Three.js
 * viewer above an "Available Downloads" strip. Falls back to the bundled demo
 * model when a product has no CAD model attached yet.
 */
export function CadViewerPanel({ productId }: CadViewerPanelProps) {
  const { data, isLoading } = useProductSectionContent(
    productId,
    "cad_preview",
  );
  const content = (data?.content ?? null) as CadPreviewContent | null;

  const [handle, setHandle] = useState<CadViewerHandle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const modelUrl = content?.viewerUrl || FALLBACK_MODEL_URL;
  const modelName = content?.modelName || FALLBACK_NAME;

  // Download cards: STL is generated live from the mesh; the rest come from the
  // backend (or the bundled DXF in fallback mode).
  const fileDownloads: CadDownload[] = useMemo(() => {
    if (content?.downloads?.length) return content.downloads;
    return [{ label: "DXF", url: FALLBACK_DXF_URL, ext: ".dxf" }];
  }, [content]);

  const modelSlug = useMemo(
    () =>
      (modelName || FALLBACK_NAME)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "model",
    [modelName],
  );

  const downloadFile = useCallback(
    (url: string, label: string, ext: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${modelSlug}${ext || ""}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNotice(null);
      void label;
    },
    [modelSlug],
  );

  const downloadSTL = useCallback(() => {
    if (handle) handle.exportSTL();
    else setNotice("The model is still loading — try again in a moment.");
  }, [handle]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <Typography variant="h3" className="flex items-center gap-2">
          <Box className="size-5" />
          3D CAD Model
        </Typography>
        <Typography variant="muted" className="text-sm">
          Interact with the model or download CAD files.
        </Typography>
      </div>

      {/* Interactive viewer (wait for the section so we load the right URL once) */}
      {isLoading ? (
        <div className="h-[520px] w-full animate-pulse rounded-xl border bg-muted" />
      ) : (
        <CadViewer
          key={modelUrl}
          modelUrl={modelUrl}
          modelName={modelName}
          onReady={setHandle}
        />
      )}

      {/* Available downloads */}
      <div className="rounded-xl border bg-card p-5">
        <Typography variant="h4" className="mb-4">
          Available Downloads
        </Typography>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* STL is generated on the fly from the loaded mesh */}
          <button
            type="button"
            onClick={downloadSTL}
            className="group flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span
              className={`flex size-11 items-center justify-center rounded-lg text-[11px] font-bold ${badgeColor("stl")}`}
            >
              STL
            </span>
            <span className="text-sm font-medium">STL</span>
            <span className="text-xs text-muted-foreground">.stl</span>
            <Download className="size-4 text-muted-foreground group-hover:text-foreground" />
          </button>

          {fileDownloads.map((f) => (
            <button
              key={f.url}
              type="button"
              onClick={() => downloadFile(f.url, f.label, f.ext)}
              className="group flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-lg text-[11px] font-bold ${badgeColor(f.label, f.ext)}`}
              >
                {f.label}
              </span>
              <span className="text-sm font-medium">{f.label}</span>
              <span className="text-xs text-muted-foreground">
                {f.ext || "file"}
              </span>
              <Download className="size-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Request-a-format row */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <Box className="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <Typography variant="small" className="font-semibold">
              Need a different format?
            </Typography>
            <Typography variant="muted" className="text-xs">
              {notice ??
                "Contact our team for other CAD formats (STEP, IGES) or custom 3D models."}
            </Typography>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:sales.blr@airmaster.co.in?subject=${encodeURIComponent(`CAD format request - ${modelName}`)}`}>
            <Mail className="size-4" />
            Request format
          </a>
        </Button>
      </div>
    </div>
  );
}
