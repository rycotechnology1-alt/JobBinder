"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type Props = {
  endpoint: string;
  label: string;
  title: string;
  message: string;
  onDeleted: () => void;
  triggerText?: string;
  className?: string;
};

export function DeleteConfirmationButton({
  endpoint,
  label,
  title,
  message,
  onDeleted,
  triggerText,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete item.");
      }

      setIsOpen(false);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete item.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger"
        size="sm"
        aria-label={label}
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <Trash2 size={15} />
        {triggerText}
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title}>
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">{message}</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
