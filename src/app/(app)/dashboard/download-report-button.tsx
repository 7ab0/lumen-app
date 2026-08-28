"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function DownloadReportButton() {
  return (
    <a href="/api/reportes/diario">
      <Button size="sm" variant="secondary">
        <Download className="h-4 w-4" />
        Descargar reporte del día
      </Button>
    </a>
  );
}
