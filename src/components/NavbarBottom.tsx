"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import { Home, FileText, Mail, User, ChartBar, Activity, BarChart3 } from "lucide-react";

export default function NavbarBottom() {
  const path = usePathname();
  const { currentTheme, isDark } = useTheme();
  
  const isActive = (href: string) => {
    if (href === '/v1') return path === '/v1';
    return path.startsWith(href);
  };

  // Navigation items (4 items + 1 center)
  const navItems = [
    { href: '/sessions', icon: FileText, label: 'Sesi' },
    { href: '/transaksi', icon: Activity, label: 'Aktivitas' },
    { href: '/v1', isCenter: true, label: 'Home' }, // Center placeholder
    { href: '/statistik', icon: BarChart3, label: 'Statistik' },
    { href: '/settings', icon: User, label: 'Settings' },
  ];

  // Center button (Beranda)
  const centerItem = { 
    href: '/v1', 
    iconKey: 'home' as const, 
    label: 'Beranda',
    centerText: currentTheme.name.substring(0, 2).toUpperCase()
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="relative max-w-lg mx-auto">
        {/* Center Elevated Button */}
        <Link 
          href={centerItem.href}
          className="absolute left-1/2 -translate-x-1/2 -top-6 z-10"
        >
          <div className="flex flex-col items-center">
            {/* Outer ring */}
            <div className="relative">
              <div 
                className="absolute inset-0 rounded-full opacity-20"
                style={{ 
                  background: isDark ? currentTheme.gradients.primaryDark : currentTheme.gradients.primary,
                  transform: 'scale(1.15)'
                }}
              />
              
              {/* Main button */}
              <div 
                className="relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 border-4 border-white dark:border-gray-900"
                style={{ 
                  background: isDark ? currentTheme.gradients.primaryDark : currentTheme.gradients.primary
                }}
              >
                <Home size={18} className="text-white" strokeWidth={2.5} />
              </div>
            </div>
            
            {/* Label below button */}
            <span 
              className="text-[9px] mt-0.5 font-medium"
              style={{ 
                color: isActive('/') 
                  ? (isDark ? currentTheme.colors.primaryDark : currentTheme.colors.primary)
                  : '#9CA3AF'
              }}
            >
              Home
            </span>
          </div>
        </Link>

        {/* Main navbar */}
        <div className="bg-white dark:bg-gray-900 shadow-[0_-2px_15px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_15px_rgba(0,0,0,0.2)]">
          {/* Curved top edge for center button space */}
          <svg 
            className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-24 h-6 text-white dark:text-gray-900"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
          >
            <path 
              d="M0 24 Q 20 0, 50 0 T 100 24 Z" 
              fill="currentColor"
            />
          </svg>

          <div className="relative px-2 pb-1 pt-2">
            <ul className="flex justify-around items-center">
              {navItems.map((item: any) => {
                // Skip rendering center button here (it's rendered separately above)
                if (item.isCenter) {
                  return <li key={item.href} className="w-14" aria-hidden="true" />;
                }
                
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <li key={item.href}>
                    <Link 
                      href={item.href as any} 
                      className="group flex flex-col items-center justify-center py-1.5 px-3 transition-all duration-300"
                    >
                      {/* Icon */}
                      <div className="relative">
                        <Icon 
                          size={18} 
                          className={`transition-all duration-300 ${
                            active 
                              ? 'scale-110' 
                              : 'group-hover:scale-105'
                          }`}
                          style={{
                            color: active 
                              ? (isDark ? currentTheme.colors.primaryDark : currentTheme.colors.primary)
                              : '#9CA3AF',
                            strokeWidth: active ? 2.5 : 2
                          }}
                        />
                        {active && (
                          <div 
                            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                            style={{ 
                              backgroundColor: isDark ? currentTheme.colors.primaryDark : currentTheme.colors.primary 
                            }}
                          />
                        )}
                      </div>
                      
                      {/* Label */}
                      <span 
                        className={`text-[9px] mt-0.5 font-medium transition-all duration-300`}
                        style={{
                          color: active 
                            ? (isDark ? currentTheme.colors.primaryDark : currentTheme.colors.primary)
                            : '#9CA3AF'
                        }}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
}
