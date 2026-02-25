"use client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Disable React DevTools in production
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Disable React DevTools
      if (typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'object') {
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function() {};
      }
      
      // Prevent ethereum conflicts
      if ((window as any).ethereum) {
        try {
          Object.defineProperty(window, 'ethereum', {
            configurable: false,
            writable: false,
            value: (window as any).ethereum
          });
        } catch (e) {
          // Ignore if already defined
        }
      }
    }
  }, []);

  return <ThemeProvider>{children}</ThemeProvider>;
}
