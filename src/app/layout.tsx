import "./globals.css";
import { Providers } from "./providers";
import { AuthProvider } from "@/contexts/AuthContext";
import PersistentComponents from "@/components/PersistentComponents";

// Metadata must be in a server component, moved to separate file

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <title>P2P Tracker - USDT Trading Management</title>
        <meta name="description" content="Track P2P USDT trading profits and sessions with smart FIFO calculation" />
        
        {/* Favicon and Icons */}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="alternate icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <link rel="mask-icon" href="/icon.svg" color="#7c3aed" />
        
        {/* PWA and Mobile */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        
        {/* Open Graph */}
        <meta property="og:title" content="P2P Tracker" />
        <meta property="og:description" content="Advanced P2P USDT Trading Management System" />
        <meta property="og:image" content="/icon.svg" />
        <meta property="og:type" content="website" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <Providers>
          <AuthProvider>
            {children}
            <PersistentComponents />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
