"use client";

import { useCallback, useEffect, useState } from "react";
import { registerScanicScannerLauncher } from "./scanicProvider";
import { ScanicScannerModal } from "./ScanicScannerModal";
import type { DocumentScannerProvider, ScannerResult } from "./scanicTypes";

type PendingScannerRequest = {
  options: Parameters<DocumentScannerProvider["openScanner"]>[0];
  resolve: (result: ScannerResult) => void;
  reject: (error: Error) => void;
};

export function ScanicScannerHost() {
  const [request, setRequest] = useState<PendingScannerRequest | null>(null);

  const openScanner = useCallback<DocumentScannerProvider["openScanner"]>((options) => {
    return new Promise((resolve, reject) => {
      setRequest({ options, resolve, reject });
    });
  }, []);

  useEffect(() => registerScanicScannerLauncher(openScanner), [openScanner]);

  const closeRequest = useCallback(() => {
    setRequest((currentRequest) => {
      currentRequest?.reject(new Error("Scanner canceled."));
      return null;
    });
  }, []);

  const completeRequest = useCallback((result: ScannerResult) => {
    setRequest((currentRequest) => {
      currentRequest?.resolve(result);
      return null;
    });
  }, []);

  if (!request) return null;

  return (
    <ScanicScannerModal
      isOpen
      maxPages={request?.options.maxPages}
      defaultFileName={request?.options.defaultFileName}
      onComplete={completeRequest}
      onCancel={closeRequest}
    />
  );
}
