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
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
