import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import { translate } from "@vitalets/google-translate-api";
import { download as downloadTikTok } from "@silent-tech-offc/ttdl";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asc, eq } from "drizzle-orm";
import {
  db,
  messagesTable,
} from "@workspace/db";
import {
  AiProviderError,
  aiFailureMessage,
  ensureConfig,
  generateReply,
  getOrCreateConversation,
} from "./routes/bot";
import { logger } from "./lib/logger";
import {
  findSavedVideo,
  listSavedVideos,
  readSavedVideo,
  saveDownloadedVideo,
} from "./saved-videos";
import {
  handleFeatureCommand,
  initializeSchedules,
  isAutoReplyEnabled,
  setAutoReply,
} from "./whatsapp-features";

type BotStatus = "starting" | "qr" | "connected" | "disconnected" | "logged_out" | "error";

let status: BotStatus = "starting";
let qrValue: string | null = null;
let qrImage: string | null = null;
let connectedNumber: string | null = null;
let isStarting = false;
let reconnectDelayMs = 5_000;
const authDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "auth_info");
const aiHistory = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();
const execFileAsync = promisify(execFile);

const quotes = [
  "Kesuksesan adalah kumpulan dari usaha-usaha kecil yang diulang setiap hari.",
  "Jangan tunggu waktu yang tepat, ciptakan waktu itu sendiri.",
  "Kegagalan hanyalah kesempatan untuk memulai lagi dengan lebih cerdas.",
];

const menuText = `╭━━━〔 *WA AI BOT* 〕━━━╮
┃  *Asisten WhatsApp pribadi*
╰━━━━━━━━━━━━━━━━━━━━╯

🤖 *AI & CHAT*
• *.ai* <pertanyaan>
• *.resetai* — hapus konteks chat
• *.auto* on/off/status — aktifkan/nonaktifkan balas AI per chat

🧰 *PRODUKTIVITAS*
• *.note* tambah/list/hapus
• *.todo* tambah/list/selesai/hapus
• *.reminder* <menit> <pesan>
• *.jadwal* <waktu> | <pesan>

🌐 *INFORMASI*
• *.cuaca* <kota>
• *.wiki* <topik>
• *.kurs* <jumlah> USD IDR
• *.tr* <kode> <teks>

🛠️ *TOOLS*
• *.calc* <ekspresi>
• *.qr* <teks>
• *.short* <url>
• *.poll* pertanyaan|opsi|opsi
• *.sticker* / *.toimg*
• Kirim link TikTok di chat pribadi untuk download
• *.saved* / *.getsave* <id>
👥 *.tagall* <pesan> — tandai anggota grup (admin)
👋 Pesan sambutan otomatis untuk anggota baru

🎲 *HIBURAN*
• *.quote* • *.pantun* • *.fakta* • *.meme*
• *.umur* DD-MM-YYYY • *.zodiak* DD-MM
• *.pilih* a|b|c • *.dadu* • *.koin*
• *.pass* <panjang>

ℹ️ *.help* <fitur> — contoh lengkap
📡 *.status* / *.ping* — cek koneksi bot`;

const helpText: Record<string, string> = {
  ai: "🤖 *.ai <pertanyaan>*\nContoh: .ai Buatkan caption untuk produk kopi",
  auto: "🔁 Balasan AI chat biasa nonaktif secara default.\n*.auto on* — aktifkan untuk chat ini\n*.auto off* — nonaktifkan untuk chat ini\n*.auto status* — cek mode saat ini",
  note: "📝 *.note tambah <teks>*\n.note — lihat catatan\n.note hapus <nomor>",
  todo: "✅ *.todo tambah <teks>*\n.todo — lihat tugas\n.todo selesai <nomor>\n.todo hapus <nomor>",
  reminder: "⏰ *.reminder <menit> <pesan>*\nContoh: .reminder 10 Jangan lupa meeting",
  jadwal: "📅 *.jadwal besok jam 8 | pesan*\n.jadwal setiap hari jam 8 | pesan\n.jadwal list\n.jadwal hapus <id>",
  cuaca: "🌤️ *.cuaca <kota>*\nContoh: .cuaca Makassar",
  kurs: "💱 *.kurs <jumlah> <asal> <tujuan>*\nContoh: .kurs 100 USD IDR",
  sticker: "🎨 Kirim gambar/video dengan caption *.sticker*.\nReply stiker dengan *.toimg* untuk mengubahnya menjadi gambar. Perlu ffmpeg (Termux: pkg install ffmpeg).",
  saved: "📥 Kirim link TikTok ke chat pribadi untuk mengunduh tanpa watermark.\n.saved — lihat video tersimpan\n.getsave <id> — kirim ulang video tersimpan",
  poll: "📊 *.poll pertanyaan|opsi 1|opsi 2*",
  calc: "🧮 *.calc <ekspresi>*\nContoh: .calc (12*7)-3",
};

function textFromMessage(message: any) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}

function getChatId(message: any) {
  return message.key.remoteJid as string;
}

function isPrivateChat(chatId: string) {
  return chatId.endsWith("@s.whatsapp.net") || chatId.endsWith("@lid");
}

type SocialLink = { platform: "TikTok" | "Instagram" | "YouTube"; url: string };

function detectSocialLink(text: string): SocialLink | undefined {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[),.!?]+$/, "");
    try {
      const url = new URL(cleanUrl);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
        return { platform: "TikTok", url: cleanUrl };
      }
      if (host === "instagram.com" || host.endsWith(".instagram.com")) {
        return { platform: "Instagram", url: cleanUrl };
      }
      if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
        return { platform: "YouTube", url: cleanUrl };
      }
    } catch {
      // Ignore malformed links and continue checking the message.
    }
  }
  return undefined;
}

async function fetchVideo(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) {
    throw new Error(`Video download failed with HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  const maxBytes = 64 * 1024 * 1024;
  if (declaredLength > maxBytes) throw new Error("Video exceeds the 64 MB limit");

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Video exceeds the 64 MB limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function convertMedia(input: Buffer, inputMime: string, outputExt: "webp" | "png", animated = false) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wa-bot-media-"));
  const extension = inputMime.split("/")[1]?.split(";")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const inputPath = path.join(directory, `input.${extension}`);
  const outputPath = path.join(directory, `output.${outputExt}`);
  try {
    await writeFile(inputPath, input);
    const filters = outputExt === "webp"
      ? animated
        ? "fps=12,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
        : "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
      : "scale=1024:1024:force_original_aspect_ratio=decrease";
    const args = ["-hide_banner", "-loglevel", "error", "-y", "-i", inputPath];
    if (animated) args.push("-t", "7");
    args.push("-vf", filters);
    if (outputExt === "webp") args.push("-vcodec", "libwebp", "-quality", "65", "-loop", "0", "-an");
    else args.push("-frames:v", "1", "-f", "image2");
    args.push(outputPath);
    await execFileAsync("ffmpeg", args, { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 });
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function handleSocialLink(sock: any, message: any, link: SocialLink) {
  const chatId = getChatId(message);
  if (link.platform !== "TikTok") {
    await sendText(
      sock,
      message,
      `Link ${link.platform} terdeteksi. Downloader otomatis saat ini mendukung TikTok.`,
    );
    return;
  }

  await sock.sendPresenceUpdate("composing", chatId);
  try {
    const result = await downloadTikTok(link.url);
    if (!result.videoNoWatermark) throw new Error("No watermark video URL was not returned");
    const content = await fetchVideo(result.videoNoWatermark);
    const saved = await saveDownloadedVideo({
      title: result.title || "TikTok video",
      sourceUrl: link.url,
      ownerJid: chatId,
      content,
    });
    await sock.sendMessage(
      chatId,
      {
        video: content,
        mimetype: "video/mp4",
        caption: `✅ Video TikTok tanpa watermark\nID simpan: ${saved.id}\nLihat daftar: .saved`,
      },
      { quoted: message },
    );
  } catch (error) {
    logger.warn({ err: error }, "TikTok download failed");
    await sendText(sock, message, "Maaf, video TikTok gagal diunduh. Pastikan tautannya publik lalu coba lagi.");
  }
}

function getHistory(chatId: string) {
  const current = aiHistory.get(chatId) ?? [];
  aiHistory.set(chatId, current);
  return current;
}

async function sendText(sock: any, message: any, text: string) {
  await sock.sendMessage(getChatId(message), { text }, { quoted: message });
}

async function runAi(sock: any, message: any, question: string) {
  const chatId = getChatId(message);
  const config = await ensureConfig();
  const history = getHistory(chatId);
  const userMessage = { role: "user" as const, content: question };
  const reply = await generateReply(config, [...history, userMessage].slice(-10));
  await sendText(sock, message, reply);
  aiHistory.set(chatId, [
    ...history,
    userMessage,
    { role: "assistant" as const, content: reply },
  ].slice(-20));

  try {
    const conversation = await getOrCreateConversation(chatId, chatId.replace("@s.whatsapp.net", ""));
    await db.insert(messagesTable).values([
      { conversationId: conversation.id, role: "user", content: question },
      { conversationId: conversation.id, role: "assistant", content: reply },
    ]);
  } catch (error) {
    logger.warn({ err: error }, "AI reply sent but conversation history could not be saved");
  }
}

async function handleCommand(sock: any, message: any, name: string, args: string[]) {
  const chatId = getChatId(message);
  if (name === "saved") {
    if (!isPrivateChat(chatId)) {
      await sendText(sock, message, "Perintah .saved hanya tersedia di chat pribadi dengan bot.");
      return;
    }
    const videos = await listSavedVideos(chatId);
    if (videos.length === 0) {
      await sendText(sock, message, "Belum ada video tersimpan. Kirim link TikTok ke chat pribadi ini untuk mengunduhnya.");
      return;
    }
    const lines = videos.slice(0, 15).map((video) =>
      `• ${video.id} — ${video.title.slice(0, 90)} (${new Date(video.savedAt).toLocaleDateString("id-ID")})`,
    );
    const more = videos.length > lines.length ? `\n…dan ${videos.length - lines.length} video lainnya.` : "";
    await sendText(sock, message, `📥 Video tersimpan:\n${lines.join("\n")}${more}\n\nKirim .getsave <id> untuk menerima ulang video.`);
    return;
  }

  if (name === "getsave") {
    if (!isPrivateChat(chatId)) {
      await sendText(sock, message, "Perintah .getsave hanya tersedia di chat pribadi dengan bot.");
      return;
    }
    const id = args[0]?.trim();
    if (!id) {
      await sendText(sock, message, "Format: .getsave <id> (lihat ID dengan .saved)");
      return;
    }
    const video = await findSavedVideo(id, chatId);
    if (!video) {
      await sendText(sock, message, "Video tidak ditemukan di daftar simpan Anda.");
      return;
    }
    const content = await readSavedVideo(video);
    await sock.sendMessage(
      chatId,
      { video: content, mimetype: "video/mp4", caption: `📥 ${video.title}` },
      { quoted: message },
    );
    return;
  }

  if (name === "menu") {
    await sendText(sock, message, menuText);
    return;
  }

  if (name === "help") {
    const topic = args[0]?.toLowerCase();
    await sendText(sock, message, topic && helpText[topic] ? helpText[topic] : `${menuText}\n\nKetik *.help ai*, *.help auto*, atau *.help jadwal* untuk contoh detail.`);
    return;
  }

  if (name === "tagall" || name === "mentionall") {
    if (!chatId.endsWith("@g.us")) {
      await sendText(sock, message, "Perintah .tagall hanya bisa digunakan di grup.");
      return;
    }
    const metadata = await sock.groupMetadata(chatId);
    const senderJid = message.key.participant;
    const senderIsAdmin = (metadata.participants ?? []).some(
      (participant: { id: string; admin?: string | null }) =>
        participant.id === senderJid &&
        (participant.admin === "admin" || participant.admin === "superadmin"),
    );
    if (!senderIsAdmin) {
      await sendText(sock, message, "Perintah .tagall hanya bisa digunakan admin grup.");
      return;
    }
    const mentions = (metadata.participants ?? []).map((participant: { id: string }) => participant.id);
    if (mentions.length === 0) {
      await sendText(sock, message, "Tidak ada anggota grup untuk ditandai.");
      return;
    }
    const label = args.join(" ").trim() || "Perhatian untuk semua anggota";
    const tags = mentions.map((jid: string) => `@${jid.split("@")[0]}`).join(" ");
    await sock.sendMessage(chatId, { text: `📢 ${label}\n\n${tags}`, mentions }, { quoted: message });
    return;
  }

  if (name === "ping" || name === "status") {
    await sendText(sock, message, "Pong! Bot aktif dan siap menerima pesan.");
    return;
  }

  if (name === "auto" || name === "autoreply" || name === "autobalas") {
    const mode = (args[0] ?? "status").toLowerCase();
    if (mode === "on" || mode === "aktif") {
      await setAutoReply(chatId, true);
      await sendText(sock, message, "✅ Balas otomatis aktif untuk chat ini. Semua orang bisa langsung mengirim pesan ke bot tanpa perlu membuka website.");
      return;
    }
    if (mode === "off" || mode === "nonaktif") {
      await setAutoReply(chatId, false);
      await sendText(sock, message, "⏸️ Balas otomatis dimatikan untuk chat ini. Gunakan .auto on untuk mengaktifkannya lagi.");
      return;
    }
    await sendText(sock, message, `🔁 Balas otomatis saat ini: *${await isAutoReplyEnabled(chatId) ? "AKTIF" : "NONAKTIF"}*\nGunakan .auto on atau .auto off.`);
    return;
  }

  if (name === "owner") {
    await sendText(sock, message, "Bot AI WhatsApp aktif. Hubungi pemilik bot untuk bantuan lanjutan.");
    return;
  }

  if (name === "quote" || name === "kutipan") {
    await sendText(sock, message, `"${quotes[Math.floor(Math.random() * quotes.length)]}"`);
    return;
  }

  if (name === "resetai" || name === "clearai") {
    aiHistory.set(chatId, []);
    await sendText(sock, message, "Riwayat obrolan AI di chat ini sudah direset.");
    return;
  }

  if (name === "calc") {
    const expression = args.join(" ").trim();
    if (!expression || !/^[0-9+\-*/().\s]+$/.test(expression)) {
      await sendText(sock, message, "Format kalkulator: .calc 12*7-3");
      return;
    }
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      await sendText(sock, message, `Hasil: ${result}`);
    } catch {
      await sendText(sock, message, "Ekspresi tidak dapat dihitung.");
    }
    return;
  }

  if (name === "tr" || name === "translate") {
    if (args.length < 2) {
      await sendText(sock, message, "Format: .tr en Selamat pagi semua");
      return;
    }
    const result = await translate(args.slice(1).join(" "), { to: args[0] });
    await sendText(sock, message, `Hasil terjemahan (${args[0]}):\n${result.text}`);
    return;
  }

  if (name === "sticker" || name === "s" || name === "stiker") {
    const media = message.message?.imageMessage ?? message.message?.videoMessage;
    if (!media) {
      await sendText(sock, message, "Kirim gambar/video dengan caption .sticker untuk membuat stiker.");
      return;
    }
    try {
      const input = await downloadMediaMessage(message, "buffer", {});
      const sticker = await convertMedia(input, media.mimetype ?? "image/jpeg", "webp", Boolean(message.message?.videoMessage));
      await sock.sendMessage(chatId, { sticker, mimetype: "image/webp" }, { quoted: message });
    } catch (error) {
      logger.warn({ err: error }, "Sticker conversion failed");
      await sendText(
        sock,
        message,
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "FFmpeg belum terpasang. Jalankan `pkg install ffmpeg` di Termux, lalu coba lagi."
          : "Gambar/video gagal diubah menjadi stiker. Coba media lain atau video yang lebih pendek.",
      );
    }
    return;
  }

  if (name === "toimg" || name === "toimage") {
    const context = message.message?.extendedTextMessage?.contextInfo;
    const quoted = context?.quotedMessage;
    if (!quoted?.stickerMessage) {
      await sendText(sock, message, "Reply sebuah stiker dengan caption .toimg.");
      return;
    }
    const target = {
      message: quoted,
      key: { ...message.key, id: context.stanzaId },
    };
    try {
      const buffer = await downloadMediaMessage(target, "buffer", {});
      const image = await convertMedia(buffer, "image/webp", "png");
      await sock.sendMessage(chatId, { image, mimetype: "image/png" }, { quoted: message });
    } catch (error) {
      logger.warn({ err: error }, "Sticker-to-image conversion failed");
      await sendText(
        sock,
        message,
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? "FFmpeg belum terpasang. Jalankan `pkg install ffmpeg` di Termux, lalu coba lagi."
          : "Stiker gagal diubah menjadi gambar. Coba stiker lain.",
      );
    }
    return;
  }

  if (name === "ai" || name === "ask" || name === "gpt") {
    const question = args.join(" ").trim();
    if (!question) {
      await sendText(sock, message, "Tulis pertanyaan, contoh: .ai jelaskan apa itu fotosintesis");
      return;
    }
    await sock.sendPresenceUpdate("composing", chatId);
    await runAi(sock, message, question);
    return;
  }

  // Extended archive features live in a separate module to keep lifecycle and
  // the existing AI/media commands isolated.
  await handleFeatureCommand(sock, message, name, args);
}

export function getWhatsappStatus() {
  return { status, qr: qrValue, qrImage, connectedNumber };
}

export async function startWhatsappBot() {
  if (process.env.WHATSAPP_BOT_ENABLED === "false" || isStarting) return;
  isStarting = true;
  status = "starting";
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    logger.info({ authDir }, "Loaded WhatsApp auth state");

    let version: [number, number, number] | undefined;
    try {
      version = (await fetchLatestBaileysVersion()).version;
    } catch (error) {
      logger.warn({ err: error }, "Could not fetch latest WhatsApp version; using Baileys default");
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
    });
    sock.ws.on("error", (error: Error) => {
      logger.warn({ err: error }, "WhatsApp socket error");
    });

    sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrValue = qr;
        qrImage = null;
        status = "qr";
        console.log("\nScan QR WhatsApp ini dari Perangkat tertaut > Tautkan perangkat:\n");
        qrcode.generate(qr, { small: true });
        void QRCode.toDataURL(qr, { width: 280, margin: 1 }).then((image: string) => {
          if (qrValue === qr) qrImage = image;
        });
      }
      if (connection === "open") {
        reconnectDelayMs = 5_000;
        status = "connected";
        qrValue = null;
        qrImage = null;
        connectedNumber = sock.user?.id?.split(":")[0] ?? null;
        initializeSchedules(sock);
        isStarting = false;
      }
      if (connection === "close") {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        status = shouldReconnect ? "disconnected" : "logged_out";
        isStarting = false;
        if (!shouldReconnect) {
          logger.error(
            { authDir, statusCode },
            "WhatsApp session logged out; preserve auth_info and remove it manually only to pair again",
          );
        }
        if (shouldReconnect) {
          const delay = reconnectDelayMs;
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
          logger.warn({ delay }, "WhatsApp connection closed; retrying");
          setTimeout(() => void startWhatsappBot(), delay);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("group-participants.update", async ({ id, participants, action }: any) => {
      if (action !== "add" || !Array.isArray(participants) || participants.length === 0) return;
      try {
        const mentions = participants.slice(0, 20);
        const names = mentions.map((jid: string) => `@${jid.split("@")[0]}`).join(" ");
        const extra = participants.length > mentions.length ? ` dan ${participants.length - mentions.length} anggota lain` : "";
        await sock.sendMessage(
          id,
          { text: `👋 Selamat datang ${names}${extra}!`, mentions },
        );
      } catch (error) {
        logger.warn({ err: error, groupId: id }, "Could not send group welcome message");
      }
    });
    sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
      if (type !== "notify") return;
      for (const message of messages) {
        if (!message?.message || message.key.fromMe) continue;
        const text = textFromMessage(message.message).trim();
        if (getChatId(message) === "status@broadcast") continue;
        if (!text.startsWith(".")) {
          const chatId = getChatId(message);
          const socialLink = isPrivateChat(chatId) ? detectSocialLink(text) : undefined;
          if (socialLink) {
            await handleSocialLink(sock, message, socialLink);
            continue;
          }
          if (text && await isAutoReplyEnabled(getChatId(message))) {
            try {
              await sock.sendPresenceUpdate("composing", getChatId(message));
              await runAi(sock, message, text);
            } catch (error) {
              await sendText(
                sock,
                message,
                error instanceof AiProviderError
                  ? `⚠️ ${aiFailureMessage(error)}`
                  : "Maaf, AI sedang tidak tersedia. Coba lagi beberapa saat.",
              );
            }
          }
          continue;
        }

        const [commandName, ...args] = text.slice(1).trim().split(/\s+/);
        if (!commandName) continue;
        try {
          await handleCommand(sock, message, commandName.toLowerCase(), args);
        } catch (error) {
          await sendText(
            sock,
            message,
            error instanceof AiProviderError
              ? `⚠️ ${aiFailureMessage(error)}`
              : "Maaf, perintah itu belum bisa dijalankan sekarang.",
          );
        }
      }
    });
  } catch (error) {
    status = "error";
    isStarting = false;
    const delay = reconnectDelayMs;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
    logger.error({ err: error, delay }, "WhatsApp startup failed; retrying");
    setTimeout(() => void startWhatsappBot(), delay);
  }
}
