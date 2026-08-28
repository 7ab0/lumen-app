import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Users, Landmark, LayoutDashboard } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Agenda", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/prestamos", label: "Préstamos", icon: Landmark },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
];
