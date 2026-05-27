import { processNextOfficePreview } from "@/lib/services/FilePreviewConversionService";
import { convertOfficeBufferToPdfWithLibreOffice } from "@/lib/services/LibreOfficePreviewConverter";

export async function runFilePreviewWorkerOnce() {
  return processNextOfficePreview({
    convertToPdf: convertOfficeBufferToPdfWithLibreOffice,
  });
}
