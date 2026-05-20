"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4 pt-20 sm:pt-4 bg-zinc-950/80 backdrop-blur-sm">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("glass relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]", className)}
      >
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-full text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
