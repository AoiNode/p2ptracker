"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Root page always redirects to /v2 (default version)
export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/v2');
  }, [router]);
  
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
    </div>
  );
}
