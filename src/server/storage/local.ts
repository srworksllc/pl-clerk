import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export async function saveFile(
  userId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const userDir = join(UPLOAD_DIR, userId);
  await mkdir(userDir, { recursive: true });

  const ext = fileName.split(".").pop() ?? "pdf";
  const safeName = `${nanoid()}.${ext}`;
  const filePath = join(userDir, safeName);

  await writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be deleted
  }
}
