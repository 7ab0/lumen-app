"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";

export function DownloadContractButton({ loanId }: { loanId: string }) {
  return (
    <a href={`/api/prestamos/${loanId}/contrato`}>
      <Button size="sm" variant="outline">
        <FileDown className="h-4 w-4" />
        Descargar contrato (PDF)
      </Button>
    </a>
  );
}
