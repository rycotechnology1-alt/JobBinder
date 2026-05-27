import prisma from "@/lib/prisma";
import { downloadR2Object, uploadR2Object } from "@/lib/r2";

const OFFICE_PREVIEW_KIND = "OFFICE_PDF";
const PDF_CONTENT_TYPE = "application/pdf";

type ConversionContext = {
  inputStorageKey: string;
  artifactId: string;
};

type Converter = (input: Buffer, context: ConversionContext) => Promise<Buffer>;

export type ProcessPreviewResult =
  | { status: "idle" }
  | { status: "processed"; artifactId: string }
  | { status: "failed"; artifactId: string; error: string };

export function createPreviewStorageKey(companyId: string, fileId: string, artifactId: string) {
  return `${companyId}/previews/${fileId}/${artifactId}.pdf`;
}

export async function processNextOfficePreview(input: {
  convertToPdf: Converter;
}): Promise<ProcessPreviewResult> {
  const artifact = await prisma.filePreviewArtifact.findFirst({
    where: {
      kind: OFFICE_PREVIEW_KIND,
      status: "QUEUED",
    },
    orderBy: { updatedAt: "asc" },
    include: {
      file: {
        select: {
          id: true,
          companyId: true,
          url: true,
        },
      },
    },
  });

  if (!artifact) return { status: "idle" };

  await prisma.filePreviewArtifact.update({
    where: { id: artifact.id },
    data: { status: "PROCESSING", lastError: null },
  });

  try {
    const originalBytes = await downloadR2Object(artifact.file.url);
    const pdfBytes = await input.convertToPdf(originalBytes, {
      inputStorageKey: artifact.file.url,
      artifactId: artifact.id,
    });
    const storageKey = createPreviewStorageKey(artifact.file.companyId, artifact.file.id, artifact.id);

    await uploadR2Object(storageKey, pdfBytes, PDF_CONTENT_TYPE);
    await prisma.filePreviewArtifact.update({
      where: { id: artifact.id },
      data: {
        status: "READY",
        storageKey,
        contentType: PDF_CONTENT_TYPE,
        lastError: null,
      },
    });

    return { status: "processed", artifactId: artifact.id };
  } catch (conversionError) {
    const message = conversionError instanceof Error ? conversionError.message : "Preview conversion failed";
    await prisma.filePreviewArtifact.update({
      where: { id: artifact.id },
      data: {
        status: "FAILED",
        lastError: message,
      },
    });
    return { status: "failed", artifactId: artifact.id, error: message };
  }
}
