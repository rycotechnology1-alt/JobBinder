"use client";

import type { DocumentScannerProvider, ScannerResult } from "./scanicTypes";

type OpenScanner = DocumentScannerProvider["openScanner"];

let activeLauncher: OpenScanner | null = null;

export function registerScanicScannerLauncher(launcher: OpenScanner) {
  activeLauncher = launcher;

  return () => {
    if (activeLauncher === launcher) {
      activeLauncher = null;
    }
  };
}

export const scanicScannerProvider: DocumentScannerProvider = {
  openScanner(options) {
    if (!activeLauncher) {
      return Promise.reject(new Error("Scanner is unavailable. Upload a file instead."));
    }

    return activeLauncher(options);
  },
};

export type { DocumentScannerProvider, ScannerResult };

