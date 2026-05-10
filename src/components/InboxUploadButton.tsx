"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AssetUploadModal } from "@/components/AssetUploadModal";

export function InboxUploadButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)} className="gap-2">
        <UploadCloud size={16} />
        Upload File
      </Button>
      <AssetUploadModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Upload to Inbox"
      />
    </>
  );
}
