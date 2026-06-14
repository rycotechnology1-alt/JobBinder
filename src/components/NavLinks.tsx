"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Jobs", icon: HardHat },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings/team", label: "Team", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-brand",
              isActive ? "text-brand" : "text-zinc-400",
            )}
          >
            <Icon size={20} />
            <span className="hidden md:inline">{link.label}</span>
          </Link>
        );
      })}
    </>
  );
}
