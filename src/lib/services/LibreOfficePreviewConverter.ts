import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getInputExtension(storageKey: string) {
  const extension = storageKey.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,10}$/.test(extension) ? extension : "bin";
}

export async function convertOfficeBufferToPdfWithLibreOffice(
  input: Buffer,
  context: { inputStorageKey: string; artifactId: string },
) {
  const workspace = await mkdtemp(path.join(tmpdir(), "jobbinder-preview-"));
  const inputPath = path.join(workspace, `input.${getInputExtension(context.inputStorageKey)}`);
  const outputPath = path.join(workspace, "input.pdf");
  const libreOfficeBinary = process.env.LIBREOFFICE_BIN || "soffice";

  try {
    await writeFile(inputPath, input);
    await execFileAsync(libreOfficeBinary, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      workspace,
      inputPath,
    ], {
      windowsHide: true,
      timeout: 120_000,
    });

    return await readFile(outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "LibreOffice conversion failed";
    throw new Error(`LibreOffice preview conversion failed for ${context.artifactId}: ${message}`);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}
