"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 w-full glass border-b-0 border-zinc-800/50">
      <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
            <HardHat size={20} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-50">JobBinder</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-6">
          <Link 
            href="/inbox" 
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-brand",
              pathname === "/inbox" ? "text-brand" : "text-zinc-400"
            )}
          >
            <div className="relative">
              <Inbox size={20} />
              {/* Optional: Add a red dot if there are unread items */}
            </div>
            <span className="hidden md:inline">Inbox</span>
          </Link>
          
          {/* User Avatar Placeholder */}
          <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300">
            D
          </div>
        </div>

      </div>
    </nav>
  );
}
