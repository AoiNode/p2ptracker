"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionStore } from "@/stores/useSessionStore";
import BottomNav from "@/components/v2/BottomNav";

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fetchAllSessions = useSessionStore(s => s.fetchAllSessions);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchAllSessions().then(() => setReady(true));
    }
  }, [user, loading]);

  if (loading || !ready) {
    return (
      <div className="fixed inset-0 bg-[#0a0e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-white/60 text-sm font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white pb-20">
      <div className="max-w-lg mx-auto relative">
        {/* V1/V2 Switch - pojok kanan atas */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="text-[10px] font-medium text-gray-500">V1</span>
          <button
            onClick={() => router.push("/")}
            className="relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500 transition-colors focus:outline-none"
          >
            <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm translate-x-4.5" />
          </button>
          <span className="text-[10px] font-medium text-emerald-400">V2</span>
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
