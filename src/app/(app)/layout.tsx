import { auth } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { BottomNav } from "@/components/bottom-nav";
import { TopBar } from "@/components/top-bar";
import { PwaRegister } from "@/components/pwa-register";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // El middleware ya redirige a /login si no hay sesión; esto es un
  // resguardo adicional para TypeScript y por si el layout se renderiza
  // fuera de ese flujo.
  const role = session?.user?.role ?? "COBRADOR";
  const userName = session?.user?.name ?? "";

  return (
    <div className="flex min-h-dvh">
      <PwaRegister />
      <SidebarNav role={role} userName={userName} />
      <div className="flex flex-1 flex-col">
        <TopBar userName={userName} />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-5xl p-4 md:p-8">{children}</div>
        </main>
        <BottomNav role={role} />
      </div>
    </div>
  );
}
