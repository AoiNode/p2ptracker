"use client";
import { formatIDR } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ProfitCard(props: {
  title: string;
  monthlyPL: number;
  todayPL?: number;
  capitalIDR: number;
  capitalUSDT: number;
  roi: number;
  saldoAkhir: number;
  targetBulanan: number;
  progress: number;
}) {
  const { title, monthlyPL, todayPL, capitalUSDT, roi, targetBulanan, progress } = props;
  const { currentTheme } = useTheme();
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [displayPL, setDisplayPL] = useState(0);
  const [displayROI, setDisplayROI] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);

    // Animate numbers
    const duration = 1000;
    const steps = 60;
    const increment = monthlyPL / steps;
    const roiIncrement = roi / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setDisplayPL(increment * currentStep);
      setDisplayROI(roiIncrement * currentStep);
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setDisplayPL(monthlyPL);
        setDisplayROI(roi);
      }
    }, duration / steps);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [monthlyPL, roi, progress]);

  return (
    <div className="card-grad rounded-3xl p-5 shadow-glow animate-fade-in-up transform-gpu">
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        aria-expanded={isExpanded}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white/80 text-sm mb-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              {title}
            </div>
            <div className="text-3xl font-bold mb-1 tabular-nums animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {formatIDR(displayPL)}
            </div>
          </div>
          <div className="mt-1 text-white/80">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
          <div className="space-y-2 text-xs text-white/80">
            {todayPL !== undefined && (
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">Profit Hari Ini</span>
                <span className={`font-semibold tabular-nums ${todayPL >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {formatIDR(todayPL)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="truncate">ROI</span>
              <span className={`font-semibold tabular-nums ${roi >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {displayROI.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="truncate">USDT Tersisa</span>
              <span className="font-semibold text-white/95 tabular-nums">{capitalUSDT.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>


      <div className="mt-4 animate-fade-in" style={{ animationDelay: '0.7s' }}>
        <div className="text-white/80 text-sm mb-2 flex justify-between">
          <span>Target Bulanan</span>
          <span className="font-semibold">{formatIDR(targetBulanan)}</span>
        </div>
        <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden relative">
          <div 
            className={`h-3 rounded-full transition-all duration-1000 ease-out relative ${
              currentTheme.progressStyle === 'striped' ? 'bg-striped' :
              currentTheme.progressStyle === 'glow' ? 'shadow-glow' : ''
            }`}
            style={{ 
              width: `${Math.max(0, Math.min(100, animatedProgress))}%`,
              background: currentTheme.progressStyle === 'gradient' || currentTheme.progressStyle === 'glow' 
                ? 'var(--gradient-success)' 
                : 'var(--color-success)'
            }}
          >
            {currentTheme.progressStyle === 'simple' ? null : (
              <div className="absolute inset-0 bg-white/30 shimmer" />
            )}
          </div>
        </div>
        <div className="text-white/80 text-xs mt-2 flex justify-between">
          <span>{animatedProgress.toFixed(1)}% tercapai</span>
          <span className={animatedProgress >= 100 ? "text-emerald-300" : "text-white/60"}>
            {animatedProgress >= 100 ? "✨ Target Tercapai!" : `Sisa ${(100 - animatedProgress).toFixed(1)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
