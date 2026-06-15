"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountOption = {
  companyId: string;
  companyName: string;
  role: string;
  isActive: boolean;
};

type AccountMenuProps = {
  displayName: string;
  email: string | null;
  hasCompany: boolean;
  canManageOrganization?: boolean;
  accounts?: AccountOption[];
  signOutAction: () => void | Promise<void>;
};

export function AccountMenu({
  displayName,
  email,
  hasCompany,
  canManageOrganization = false,
  accounts = [],
  signOutAction,
}: AccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const initial = (displayName || email || "U").charAt(0).toUpperCase();
  const showAccountSwitcher = accounts.length > 1;

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

  async function switchAccount(companyId: string) {
    const target = accounts.find((account) => account.companyId === companyId);
    if (!target || target.isActive) return;

    setSwitchingCompanyId(companyId);
    try {
      const res = await fetch("/api/organization/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      }
    } finally {
      setSwitchingCompanyId(null);
    }
  }

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
            {showAccountSwitcher && (
              <div className="border-b border-zinc-800/80 pb-2 mb-2">
                {accounts.map((account) => (
                  <button
                    key={account.companyId}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      account.isActive
                        ? "bg-zinc-800 text-zinc-50"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50",
                    )}
                    disabled={switchingCompanyId !== null}
                    onClick={() => void switchAccount(account.companyId)}
                  >
                    <Building2 size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{account.companyName}</span>
                      <span className="block text-xs uppercase text-zinc-500">{account.role}</span>
                    </span>
                    {account.isActive && <Check size={15} className="shrink-0 text-brand-light" />}
                  </button>
                ))}
              </div>
            )}

            {hasCompany && canManageOrganization && (
              <Link
                href="/settings/organization"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Settings size={16} />
                Organization
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
