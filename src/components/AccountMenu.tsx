"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";

type AccountMenuProps = {
  displayName: string;
  email: string | null;
  hasCompany: boolean;
  signOutAction: () => void | Promise<void>;
};

export function AccountMenu({
  displayName,
  email,
  hasCompany,
  signOutAction,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = (displayName || email || "U").charAt(0).toUpperCase();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={`Open account menu for ${displayName}`}
        aria-expanded={isOpen}
        className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 hover:border-brand/60 transition-colors"
        onClick={() => setIsOpen((current) => !current)}
      >
        {initial}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-zinc-800 bg-zinc-950/95 shadow-2xl shadow-black/40 backdrop-blur p-2">
          <div className="px-3 py-2 border-b border-zinc-800/80">
            <p className="text-sm font-semibold text-zinc-100 truncate">{displayName}</p>
            {email && <p className="text-xs text-zinc-500 truncate">{email}</p>}
          </div>

          <div className="py-2 space-y-1">
            {hasCompany && (
              <Link
                href="/settings/team"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Settings size={16} />
                Team Settings
              </Link>
            )}

            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
