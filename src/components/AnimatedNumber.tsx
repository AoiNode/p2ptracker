"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
  showChange?: boolean;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  format,
  duration = 0.8,
  className,
  showChange = true,
  prefix = "",
  suffix = "",
  decimals = 0
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [changeAmount, setChangeAmount] = useState(0);
  const [showChangeIndicator, setShowChangeIndicator] = useState(false);

  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    const diff = endValue - startValue;
    const startTime = Date.now();
    const animationDuration = duration * 1000;

    // Show change indicator
    if (showChange && value !== previousValue) {
      const changeDiff = value - previousValue;
      setChangeAmount(changeDiff);
      setShowChangeIndicator(true);
      
      const timer = setTimeout(() => {
        setShowChangeIndicator(false);
      }, 2000);
      
      setPreviousValue(value);
      
      return () => clearTimeout(timer);
    }

    // Animate the number
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, displayValue, duration, previousValue, showChange]);

  const formattedValue = format 
    ? format(displayValue)
    : displayValue.toLocaleString("id-ID", { 
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
  
  const isIncrease = changeAmount > 0;
  
  return (
    <div className="relative inline-block">
      <span className={`tabular-nums ${className}`}>
        {prefix}{formattedValue}{suffix}
      </span>
      
      <AnimatePresence>
        {showChangeIndicator && changeAmount !== 0 && (
          <motion.div
            initial={{ opacity: 0, y: 0, x: "100%" }}
            animate={{ opacity: 1, y: -10, x: "100%" }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className={`absolute -right-2 top-0 text-xs font-bold px-1.5 py-0.5 rounded ${
              isIncrease 
                ? "text-green-600 bg-green-100" 
                : "text-red-600 bg-red-100"
            }`}
          >
            {isIncrease ? "+" : ""}{format ? format(changeAmount) : changeAmount.toLocaleString("id-ID")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AnimatedProgressProps {
  value: number;
  max: number;
  className?: string;
  color?: string;
  showPercentage?: boolean;
  height?: string;
}

export function AnimatedProgress({
  value,
  max,
  className,
  color = "from-purple-500 to-violet-600",
  showPercentage = false,
  height = "h-2"
}: AnimatedProgressProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  
  return (
    <div className={`relative w-full ${className}`}>
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${height}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedPercentage}%` }}
          transition={{ 
            duration: 0.8,
            ease: "easeOut"
          }}
          className={`h-full bg-gradient-to-r rounded-full relative ${color}`}
        >
          {/* Shimmer effect */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "linear"
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        </motion.div>
      </div>
      
      {showPercentage && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute -top-6 right-0 text-xs font-medium text-gray-600"
        >
          {clampedPercentage.toFixed(0)}%
        </motion.span>
      )}
    </div>
  );
}
