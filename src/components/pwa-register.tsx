"use client";

import { useEffect, useState } from "react";
import { syncOfflineQueue, getQueue } from "@/lib/offline-queue";

// Registra el service worker (PWA instalable) y sincroniza la cola de
// pagos offline en cuanto hay conexión. Ver plan, sección "PWA y modo
// offline".
export function PwaRegister() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // En local sin HTTPS o durante desarrollo el registro puede
        // fallar silenciosamente; no bloquea el resto de la app.
      });
    }

    async function trySync() {
      const before = await getQueue();
      setPendingCount(before.length);
      if (before.length === 0) return;
      const { synced, remaining } = await syncOfflineQueue();
      setPendingCount(remaining);
      if (synced > 0) {
        // Refresca la vista para reflejar los pagos ya sincronizados.
        window.location.reload();
      }
    }

    trySync();
    window.addEventListener("online", trySync);
    return () => window.removeEventListener("online", trySync);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
      {pendingCount} pago(s) pendiente(s) de sincronizar — se enviarán al recuperar señal.
    </div>
  );
}
