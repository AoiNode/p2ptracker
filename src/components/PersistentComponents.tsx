"use client";
import { usePathname } from "next/navigation";
import NavbarBottom from "@/components/NavbarBottom";
import FAB from "@/components/FAB";
import { useAuth } from "@/contexts/AuthContext";

export default function PersistentComponents() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Don't show navbar on login/register pages or if not authenticated
  const showNavbar = user && !pathname.includes('/login') && !pathname.includes('/register');

  // Only show FAB on specific pages: dashboard, transaksi, and sesi (sessions)
  const showFAB = showNavbar && (
    pathname === '/' || 
    pathname.includes('/transaksi') || 
    pathname.includes('/sessions')
  );

  if (!showNavbar) {
    return null;
  }

  return (
    <>
      {showFAB && <FAB />}
      <NavbarBottom />
    </>
  );
}
