export function getButtonStyle(themeId: string, type: 'primary' | 'secondary' | 'danger' | 'success' = 'primary') {
  const baseStyles = "transition-all duration-300 font-medium";
  
  const themeStyles: Record<string, Record<string, string>> = {
    default: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg hover:from-purple-600 hover:to-violet-700 shadow-md hover:shadow-lg`,
      secondary: `${baseStyles} px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600`,
      danger: `${baseStyles} px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700`,
      success: `${baseStyles} px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700`,
    },
    ocean: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full hover:from-blue-600 hover:to-cyan-600 shadow-md hover:shadow-lg`,
      secondary: `${baseStyles} px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-rose-500 text-white rounded-full hover:bg-rose-600`,
      success: `${baseStyles} px-4 py-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600`,
    },
    forest: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded hover:from-green-600 hover:to-emerald-700 shadow-sm hover:shadow-md`,
      secondary: `${baseStyles} px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800`,
      success: `${baseStyles} px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800`,
    },
    sunset: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white rounded-xl hover:from-orange-600 hover:via-red-600 hover:to-pink-600 shadow-lg hover:shadow-xl`,
      secondary: `${baseStyles} px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700`,
      success: `${baseStyles} px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700`,
    },
    midnight: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white clip-hexagon hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-purple-500/30`,
      secondary: `${baseStyles} px-4 py-2 bg-gray-800 text-gray-300 clip-hexagon hover:bg-gray-700`,
      danger: `${baseStyles} px-4 py-2 bg-rose-600 text-white clip-hexagon hover:bg-rose-700`,
      success: `${baseStyles} px-4 py-2 bg-emerald-600 text-white clip-hexagon hover:bg-emerald-700`,
    },
    sakura: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-pink-400 to-pink-600 text-white rounded-full hover:from-pink-500 hover:to-pink-700 shadow-md hover:shadow-lg border-2 border-white/30`,
      secondary: `${baseStyles} px-4 py-2 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full hover:bg-pink-200 dark:hover:bg-pink-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-rose-500 text-white rounded-full hover:bg-rose-600`,
      success: `${baseStyles} px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600`,
    },
    cosmic: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 shadow-xl shadow-purple-500/30 animate-pulse`,
      secondary: `${baseStyles} px-4 py-2 bg-purple-900/30 text-purple-300 rounded-lg hover:bg-purple-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700`,
      success: `${baseStyles} px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700`,
    },
    gold: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-white rounded hover:from-amber-700 hover:to-yellow-700 shadow-md hover:shadow-lg border border-yellow-400/50`,
      secondary: `${baseStyles} px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800`,
      success: `${baseStyles} px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800`,
    },
    cyberpunk: {
      primary: `${baseStyles} px-4 py-2 bg-black border-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-black shadow-lg shadow-cyan-500/30`,
      secondary: `${baseStyles} px-4 py-2 bg-black border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200`,
      danger: `${baseStyles} px-4 py-2 bg-black border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black`,
      success: `${baseStyles} px-4 py-2 bg-black border-2 border-lime-500 text-lime-500 hover:bg-lime-500 hover:text-black`,
    },
    vintage: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-b from-amber-700 to-amber-800 text-white rounded-sm hover:from-amber-800 hover:to-amber-900 shadow-inner border-2 border-amber-600`,
      secondary: `${baseStyles} px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-sm hover:bg-amber-200 dark:hover:bg-amber-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-800 text-white rounded-sm hover:bg-red-900`,
      success: `${baseStyles} px-4 py-2 bg-green-800 text-white rounded-sm hover:bg-green-900`,
    },
    arctic: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-blue-400 to-cyan-500 text-white rounded-full hover:from-blue-500 hover:to-cyan-600 shadow-md hover:shadow-lg backdrop-blur`,
      secondary: `${baseStyles} px-4 py-2 bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200/80 dark:hover:bg-blue-900/50 backdrop-blur`,
      danger: `${baseStyles} px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600`,
      success: `${baseStyles} px-4 py-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600`,
    },
    desert: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-700 text-white rounded-md hover:from-orange-700 hover:to-amber-800 shadow-md hover:shadow-lg`,
      secondary: `${baseStyles} px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800`,
      success: `${baseStyles} px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800`,
    },
    matrix: {
      primary: `${baseStyles} px-4 py-2 bg-black border border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-mono`,
      secondary: `${baseStyles} px-4 py-2 bg-black border border-green-700 text-green-700 hover:border-green-500 hover:text-green-500 font-mono`,
      danger: `${baseStyles} px-4 py-2 bg-black border border-red-500 text-red-500 hover:bg-red-500 hover:text-black font-mono`,
      success: `${baseStyles} px-4 py-2 bg-black border border-lime-500 text-lime-500 hover:bg-lime-500 hover:text-black font-mono`,
    },
    lavender: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-full hover:from-purple-500 hover:to-purple-700 shadow-md hover:shadow-lg`,
      secondary: `${baseStyles} px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-rose-500 text-white rounded-full hover:bg-rose-600`,
      success: `${baseStyles} px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600`,
    },
    coffee: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-b from-amber-800 to-amber-900 text-white rounded hover:from-amber-900 hover:to-black shadow-inner`,
      secondary: `${baseStyles} px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-red-900 text-white rounded hover:bg-red-950`,
      success: `${baseStyles} px-4 py-2 bg-green-900 text-white rounded hover:bg-green-950`,
    },
    aurora: {
      primary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 text-white rounded-xl hover:from-green-500 hover:via-blue-600 hover:to-purple-700 shadow-xl hover:shadow-2xl animate-gradient`,
      secondary: `${baseStyles} px-4 py-2 bg-gradient-to-r from-green-100 to-purple-100 dark:from-green-900/30 dark:to-purple-900/30 text-gray-800 dark:text-gray-200 rounded-xl hover:from-green-200 hover:to-purple-200 dark:hover:from-green-900/50 dark:hover:to-purple-900/50`,
      danger: `${baseStyles} px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600`,
      success: `${baseStyles} px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600`,
    },
  };
  
  return themeStyles[themeId]?.[type] || themeStyles.default[type];
}
