"use client";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import ImportTransactionModal from "./ImportTransactionModal";

export default function BuySellButtons() {
  const router = useRouter();
  const { currentTheme, isDark } = useTheme();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const getButtonStyles = () => {
    const baseStyles = "transition-all duration-300 font-bold text-white text-xs flex items-center justify-center";
    
    // Default import style
    const importStyle = `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl hover:scale-110`;

    switch (currentTheme.id) {
      case 'default':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-lg hover:shadow-xl hover:scale-110`,
          sell: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl hover:scale-110`,
          import: importStyle,
        };
      
      case 'ocean':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg hover:shadow-2xl hover:scale-105 rotate-3 hover:rotate-0`,
          sell: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg hover:shadow-2xl hover:scale-105 -rotate-3 hover:rotate-0`,
          import: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 shadow-lg hover:shadow-2xl hover:scale-105`,
        };
      
      case 'forest':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 shadow-md hover:shadow-lg transform hover:-translate-y-1`,
          sell: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transform hover:-translate-y-1`,
          import: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 shadow-md hover:shadow-lg transform hover:-translate-y-1`,
        };
      
      case 'sunset':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 shadow-xl hover:shadow-2xl hover:scale-110 border-2 border-white/20`,
          sell: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 shadow-xl hover:shadow-2xl hover:scale-110 border-2 border-white/20`,
          import: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 shadow-xl hover:shadow-2xl hover:scale-110 border-2 border-white/20`,
        };
      
      case 'midnight':
        return {
          buy: `${baseStyles} w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 clip-hexagon`,
          sell: `${baseStyles} w-14 h-14 bg-gradient-to-br from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:scale-105 clip-hexagon`,
          import: `${baseStyles} w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 clip-hexagon`,
        };
      
      case 'sakura':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 hover:from-pink-500 hover:to-pink-700 shadow-md hover:shadow-lg hover:scale-110 border-2 border-white/50`,
          sell: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 shadow-md hover:shadow-lg hover:scale-110 border-2 border-white/50`,
          import: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 hover:from-blue-500 hover:to-indigo-600 shadow-md hover:shadow-lg hover:scale-110 border-2 border-white/50`,
        };
      
      case 'cosmic':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 shadow-xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105 animate-pulse`,
          sell: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-105 animate-pulse`,
          import: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 shadow-xl shadow-blue-500/40 hover:shadow-blue-500/60 hover:scale-105 animate-pulse`,
        };
      
      case 'gold':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 shadow-lg hover:shadow-xl transform hover:skew-x-3 border-2 border-yellow-400/50`,
          sell: `${baseStyles} w-14 h-14 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:-skew-x-3 border-2 border-emerald-400/50`,
          import: `${baseStyles} w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform border-2 border-blue-400/50`,
        };
      
      case 'cyberpunk':
        return {
          buy: `${baseStyles} w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-105 clip-path-polygon border-2 border-cyan-300`,
          sell: `${baseStyles} w-14 h-14 bg-gradient-to-br from-lime-500 to-green-500 hover:from-lime-600 hover:to-green-600 shadow-lg shadow-lime-500/50 hover:shadow-lime-500/70 hover:scale-105 clip-path-polygon border-2 border-lime-300`,
          import: `${baseStyles} w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-105 clip-path-polygon border-2 border-purple-300`,
        };
      
      case 'vintage':
        return {
          buy: `${baseStyles} w-14 h-14 rounded bg-gradient-to-b from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 shadow-inner hover:shadow-lg transform hover:scale-105 border-2 border-amber-600`,
          sell: `${baseStyles} w-14 h-14 rounded bg-gradient-to-b from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 shadow-inner hover:shadow-lg transform hover:scale-105 border-2 border-green-600`,
          import: `${baseStyles} w-14 h-14 rounded bg-gradient-to-b from-blue-700 to-blue-800 hover:from-blue-800 hover:to-blue-900 shadow-inner hover:shadow-lg transform hover:scale-105 border-2 border-blue-600`,
        };
      
      case 'arctic':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-lg hover:shadow-xl hover:scale-110 border-2 border-white/70 backdrop-blur`,
          sell: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 hover:from-cyan-500 hover:to-teal-700 shadow-lg hover:shadow-xl hover:scale-110 border-2 border-white/70 backdrop-blur`,
          import: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 hover:from-indigo-500 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-110 border-2 border-white/70 backdrop-blur`,
        };
      
      case 'desert':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 shadow-lg hover:shadow-xl hover:scale-105 transform rotate-3 hover:rotate-0`,
          sell: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 shadow-lg hover:shadow-xl hover:scale-105 transform -rotate-3 hover:rotate-0`,
          import: `${baseStyles} w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-lg hover:shadow-xl hover:scale-105 transform`,
        };
      
      case 'matrix':
        return {
          buy: `${baseStyles} w-14 h-14 bg-black border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-black shadow-lg shadow-green-500/30 hover:shadow-green-500/60 hover:scale-105 font-mono`,
          sell: `${baseStyles} w-14 h-14 bg-black border-2 border-lime-500 text-lime-500 hover:bg-lime-500 hover:text-black shadow-lg shadow-lime-500/30 hover:shadow-lime-500/60 hover:scale-105 font-mono`,
          import: `${baseStyles} w-14 h-14 bg-black border-2 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black shadow-lg shadow-blue-500/30 hover:shadow-blue-500/60 hover:scale-105 font-mono`,
        };
      
      case 'lavender':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 hover:from-purple-500 hover:to-purple-700 shadow-md hover:shadow-lg hover:scale-110 border-2 border-purple-300/50`,
          sell: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 shadow-md hover:shadow-lg hover:scale-110 border-2 border-green-300/50`,
          import: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 hover:from-indigo-500 hover:to-indigo-700 shadow-md hover:shadow-lg hover:scale-110 border-2 border-indigo-300/50`,
        };
      
      case 'coffee':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-b from-amber-800 to-amber-900 hover:from-amber-900 hover:to-black shadow-inner hover:shadow-lg transform hover:scale-105`,
          sell: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-b from-green-800 to-green-900 hover:from-green-900 hover:to-black shadow-inner hover:shadow-lg transform hover:scale-105`,
          import: `${baseStyles} w-14 h-14 rounded-lg bg-gradient-to-b from-blue-800 to-blue-900 hover:from-blue-900 hover:to-black shadow-inner hover:shadow-lg transform hover:scale-105`,
        };
      
      case 'aurora':
        return {
          buy: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 hover:from-green-500 hover:via-blue-600 hover:to-purple-700 shadow-xl hover:shadow-2xl hover:scale-110 animate-gradient`,
          sell: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-400 via-pink-500 to-red-600 hover:from-purple-500 hover:via-pink-600 hover:to-red-700 shadow-xl hover:shadow-2xl hover:scale-110 animate-gradient`,
          import: `${baseStyles} w-14 h-14 rounded-3xl bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 hover:from-blue-500 hover:via-indigo-600 hover:to-purple-700 shadow-xl hover:shadow-2xl hover:scale-110 animate-gradient`,
        };
      
      default:
        return {
          buy: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-lg hover:shadow-xl hover:scale-110`,
          sell: `${baseStyles} w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl hover:scale-110`,
          import: importStyle,
        };
    }
  };

  const styles = getButtonStyles();

  return (
    <>
      <div className="flex items-center gap-2 flex-row-reverse">
        <button
          onClick={() => setIsImportOpen(true)}
          className={styles.import}
          title="Import Transactions"
        >
          <Upload className="w-6 h-6" />
        </button>
        
        <button
          onClick={() => router.push('/transaksi/new?type=sell')}
          className={styles.sell}
        >
          SELL
        </button>
        
        <button
          onClick={() => router.push('/transaksi/new?type=buy')}
          className={styles.buy}
        >
          BUY
        </button>
      </div>

      <ImportTransactionModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onSuccess={() => {
          // Optional: trigger a refresh if needed, but fetchAllSessions is called inside modal
        }}
      />
    </>
  );
}
