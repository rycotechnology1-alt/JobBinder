"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Zap } from "lucide-react";

export function SimulateCaptureButton({ companyId, authorId }: { companyId: string, authorId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSimulate() {
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          authorId,
          type: "GENERAL",
          content: "Fast offline capture from the field! Needs to be assigned.",
          // Deliberately omitting jobId so it goes to the inbox
        }),
      });
      
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button 
      onClick={handleSimulate} 
      disabled={isSubmitting}
      className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border-0"
    >
      <Zap size={16} className="mr-2" />
      {isSubmitting ? "Capturing..." : "Simulate Offline Note"}
    </Button>
  );
}
