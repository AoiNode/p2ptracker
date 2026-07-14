"use client";
import { usePathname, useRouter } from "next/navigation";
import { Home, ArrowLeftRight, Layers, BarChart3, Settings } from "lucide-react";

const navItems = [
  { path: "/v2", icon: Home, label: "Home" },
  { path: "/v2/transaksi", icon: ArrowLeftRight, label: "Transaksi" },
  { path: "/v2/sessions", icon: Layers, label: "Sesi" },
  { path: "/v2/statistik", icon: BarChart3, label: "Statistik" },
  { path: "/settings", icon: Settings, label: "Lainnya" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === "/v2") return pathname === "/v2";
    if (path === "/settings") return pathname.startsWith("/settings");
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto">
        <div className="mx-3 mb-2 rounded-2xl bg-[#111827]/95 backdrop-blur-xl border border-white/[0.06] shadow-2xl shadow-black/50">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-200"
                >
                  {active && (
                    <div className="absolute -top-1.5 w-8 h-1 bg-emerald-500 rounded-full" />
                  )}
                  <div className={`p-1.5 rounded-xl transition-all duration-200 ${
                    active 
                      ? "bg-emerald-500/15" 
                      : "hover:bg-white/5"
                  }`}>
                    <Icon 
                      className={`w-5 h-5 transition-colors duration-200 ${
                        active ? "text-emerald-400" : "text-gray-500"
                      }`} 
                      strokeWidth={active ? 2.5 : 2}
                    />
                  </div>
                  <span className={`text-[10px] font-medium transition-colors duration-200 ${
                    active ? "text-emerald-400" : "text-gray-600"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
