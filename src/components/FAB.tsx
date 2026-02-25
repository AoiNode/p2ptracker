"use client";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { usePathname } from "next/navigation";
import BuySellButtons from "@/components/BuySellButtons";

export default function FAB() {
  const [open, setOpen] = useState(false);
  const { currentTheme } = useTheme();
  const pathname = usePathname();
  
  // Auto close when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  
  return (
    <div className="fixed bottom-28 right-4 z-40 md:bottom-24">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ scale: 0, opacity: 0, x: 20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0, opacity: 0, x: 20 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
            className="absolute bottom-0 right-16"
          >
            <BuySellButtons />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen(!open)}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="text-white w-14 h-14 rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center relative z-10"
        style={{
          background: `var(--gradient-primary)`,
          boxShadow: open ? `0 10px 30px ${currentTheme.colors.primary}40` : ''
        }}
      >
        <Plus size={24} />
      </motion.button>
    </div>
  );
}
