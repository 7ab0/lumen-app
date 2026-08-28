"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

// Barra superior visible solo en celular, con el nombre del usuario y
// cerrar sesión (en laptop esto vive en el sidebar).
export function TopBar({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Lumen</p>
        <p className="text-xs text-slate-500">{userName}</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="Cerrar sesión"
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </header>
  );
}
