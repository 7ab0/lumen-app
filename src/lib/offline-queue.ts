"use client";

import { get, set } from "idb-keyval";
import { registrarPago, type RegistrarPagoInput } from "@/server/actions/payments";

// Cola local de pagos registrados sin conexión (ver plan, sección "PWA y
// modo offline"). Se guarda en IndexedDB (vía idb-keyval) y se
// sincroniza automáticamente al recuperar señal.
const QUEUE_KEY = "lumen-offline-payments-queue";

export type QueuedPayment = RegistrarPagoInput & {
  offlineClientId: string;
  queuedAt: string;
};

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function getQueue(): Promise<QueuedPayment[]> {
  return (await get(QUEUE_KEY)) ?? [];
}

export async function queueOfflinePayment(payload: Omit<RegistrarPagoInput, "offlineClientId">) {
  const queue = await getQueue();
  const offlineClientId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const item: QueuedPayment = {
    ...payload,
    offlineClientId,
    queuedAt: new Date().toISOString(),
  };

  await set(QUEUE_KEY, [...queue, item]);
  return item;
}

// Intenta sincronizar todos los pagos en cola. Se llama al recuperar
// conexión (evento "online") y al cargar la app. Cada pago lleva
// offlineClientId para que el servidor pueda ignorar duplicados si se
// reintenta el envío.
export async function syncOfflineQueue() {
  if (!isOnline()) return { synced: 0, remaining: (await getQueue()).length };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const stillPending: QueuedPayment[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await registrarPago(item);
      synced++;
    } catch {
      stillPending.push(item);
    }
  }

  await set(QUEUE_KEY, stillPending);
  return { synced, remaining: stillPending.length };
}
