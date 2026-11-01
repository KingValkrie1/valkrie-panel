import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface SavedVideo {
  id: string;
  title: string;
  sourceUrl: string;
  ownerJid: string;
  fileName: string;
  savedAt: string;
}

const dataDir = path.resolve(process.cwd(), "data", "saved-videos");
const indexPath = path.join(dataDir, "index.json");
let writes = Promise.resolve();

async function readIndex(): Promise<SavedVideo[]> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(indexPath, "utf8"));
    return Array.isArray(value) ? (value as SavedVideo[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function listSavedVideos(ownerJid: string) {
  return (await readIndex())
    .filter((video) => video.ownerJid === ownerJid)
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export async function findSavedVideo(id: string, ownerJid: string) {
  return (await readIndex()).find(
    (video) => video.id === id && video.ownerJid === ownerJid,
  );
}

export async function saveDownloadedVideo(input: {
  title: string;
  sourceUrl: string;
  ownerJid: string;
  content: Buffer;
}) {
  await fs.mkdir(dataDir, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const fileName = `${id}.mp4`;
  const record: SavedVideo = {
    id,
    title: input.title || "TikTok video",
    sourceUrl: input.sourceUrl,
    ownerJid: input.ownerJid,
    fileName,
    savedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(dataDir, fileName), input.content);
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      const entries = await readIndex();
      entries.push(record);
      const temporaryPath = `${indexPath}.${randomUUID()}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(entries, null, 2));
      await fs.rename(temporaryPath, indexPath);
    });
  await writes;
  return record;
}

export async function readSavedVideo(video: SavedVideo) {
  return fs.readFile(path.join(dataDir, video.fileName));
}
