"use client";

import type React from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Hash, Mail, MapPin, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

type OverviewJob = {
  customerName: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  jobNumber: string | null;
  poNumber: string | null;
  contractNumber: string | null;
  description: string | null;
};

type Props = {
  job: OverviewJob;
};

export function JobOverviewCard({ job }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="w-full p-5 flex items-center justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <span className="text-lg font-semibold text-zinc-50">Overview</span>
          {isOpen ? <ChevronDown size={18} className="text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-500" />}
        </button>

        {isOpen && (
          <div className="px-5 pb-5 space-y-4">
            <div className="border-t border-zinc-800 pt-4 space-y-4">
              <OverviewItem icon={<User size={18} />} label="Customer" value={job.customerName || "Not set"} />
              <OverviewItem icon={<MapPin size={18} />} label="Address" value={job.address || "Not set"} />
              <OverviewItem icon={<User size={18} />} label="Primary Contact" value={job.contactName || "Not set"} />
              <OverviewItem icon={<Phone size={18} />} label="Phone" value={job.contactPhone || "Not set"} />
              <OverviewItem icon={<Mail size={18} />} label="Email" value={job.contactEmail || "Not set"} />
            </div>

            <div className="pt-4 flex flex-col gap-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 inline-flex items-center gap-2"><Hash size={13} /> Job #: {job.jobNumber || "Not set"}</p>
              <p className="text-xs text-zinc-500 inline-flex items-center gap-2"><Hash size={13} /> PO #: {job.poNumber || "Not set"}</p>
              <p className="text-xs text-zinc-500 inline-flex items-center gap-2"><Hash size={13} /> Contract #: {job.contractNumber || "Not set"}</p>
            </div>

            {job.description && (
              <div className="pt-4 border-t border-zinc-800">
                <p className="text-sm font-medium inline-flex items-center gap-2 mb-2">
                  <FileText size={16} className="text-zinc-500" />
                  Description
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed">{job.description}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-zinc-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-zinc-400 text-sm break-words">{value}</p>
      </div>
    </div>
  );
}
