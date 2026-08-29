"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { subirAdjunto } from "@/server/actions/attachments";
import { formatDate } from "@/lib/utils";
import { FileText, Upload } from "lucide-react";

export type AttachmentType = "DNI" | "COMPROBANTE_PAGO" | "CONTRATO" | "OTRO";

export type AttachmentItem = {
  id: string;
  type: AttachmentType;
  fileUrl: string;
  uploadedAt: Date;
  uploadedByName: string;
};

const TYPE_LABEL: Record<AttachmentType, string> = {
  DNI: "DNI",
  COMPROBANTE_PAGO: "Comprobante de pago",
  CONTRATO: "Contrato",
  OTRO: "Otro documento",
};

// Panel reutilizable de documentos adjuntos: lista lo ya subido y
// permite subir uno nuevo a Vercel Blob (ver server/actions/attachments.ts
// y plan, "Próximos pasos" — subida real de adjuntos, pendiente del MVP).
export function AttachmentsPanel({
  relatedType,
  relatedId,
  clientId,
  loanId,
  availableTypes,
  attachments,
}: {
  relatedType: "CLIENT" | "LOAN" | "PAYMENT";
  relatedId: string;
  clientId?: string;
  loanId?: string;
  availableTypes: AttachmentType[];
  attachments: AttachmentItem[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<AttachmentType>(availableTypes[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecciona un archivo primero");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await subirAdjunto({ file, relatedType, relatedId, type, clientId, loanId });
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {attachments.map((a) => (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-slate-700">
                <FileText className="h-4 w-4 text-slate-400" />
                {TYPE_LABEL[a.type]}
              </span>
              <span className="text-xs text-slate-400">
                {formatDate(a.uploadedAt)} · {a.uploadedByName}
              </span>
            </a>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AttachmentType)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          {availableTypes.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="flex-1 text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={loading}>
          <Upload className="h-4 w-4" />
          {loading ? "Subiendo..." : "Subir"}
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Badge variant="default" className="w-fit text-[10px] font-normal text-slate-400">
        JPG, PNG o PDF · máx. 10 MB
      </Badge>
    </div>
  );
}
