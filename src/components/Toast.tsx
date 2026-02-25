"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose, actionLabel, onAction }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-500',
    error: 'bg-gradient-to-r from-red-500 to-pink-500',
    info: 'bg-gradient-to-r from-purple-500 to-violet-500'
  }[type];

  const icon = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  }[type];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-24 left-0 right-0 z-[9999] px-4 pointer-events-none flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="pointer-events-auto w-full max-w-sm"
          >
            <div className={`${bgColor} text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md`}>
              <div className="flex items-center gap-2">
                <span className="text-lg flex-shrink-0">{icon}</span>
                <p className="font-medium text-xs flex-1 leading-tight">{message}</p>
                {actionLabel && onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      onAction();
                      setIsVisible(false);
                      setTimeout(() => {
                        onClose?.();
                      }, 300);
                    }}
                    className="ml-2 rounded-lg bg-white/20 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/30 active:bg-white/25 transition-colors"
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    ,
    document.body
  );
}

// Toast Manager Hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const showToast = (props: ToastProps) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...props, id }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, (props.duration ?? 3000) + 300);
  };

  return { toasts, showToast };
}
