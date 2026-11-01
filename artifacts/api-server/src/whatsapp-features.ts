import { promises as fs } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

type Message = any;
type Socket = any;
const MAX_TEXT = 500;
const dataDir = path.resolve(process.cwd(), "data");

async function request(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
function chat(msg: Message) { return msg.key.remoteJid as string; }
function say(sock: Socket, msg: Message, text: string) {
  return sock.sendMessage(chat(msg), { text: text.slice(0, 3500) }, { quoted: msg });
}
async function store<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(path.join(dataDir, `${name}.json`), "utf8")) as T; } catch { return fallback; }
}
async function save(name: string, value: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, `${name}.json`), JSON.stringify(value, null, 2));
}

export async function isAutoReplyEnabled(chatId: string) {
  const settings = await store<Record<string, boolean>>("auto-reply", {});
  // Ordinary AI replies are opt-in per chat. Dot commands such as `.menu`
  // remain available whether auto-reply is enabled or not.
  return settings[chatId] === true;
}

export async function setAutoReply(chatId: string, enabled: boolean) {
  const settings = await store<Record<string, boolean>>("auto-reply", {});
  settings[chatId] = enabled;
  await save("auto-reply", settings);
}

const pantun = [
  "Jalan-jalan ke kota Blitar\nJangan lupa membeli container\nJangan pernah kau menyerah\nKarena hidup harus terus berjalan",
  "Beli baju di pasar Minggu\nJangan lupa membeli topi\nKalau kamu rindu aku\nBilang saja jangan sembunyi",
  "Ke pasar membeli ikan\nIkan segar banyak pembeli\nKerja keras jangan dilupakan\nKarena hasil takkan mengkhianati",
];
const facts = ["Jantung udang terletak di kepalanya.", "Satu hari di Venus lebih lama daripada satu tahunnya.", "Bintang laut tidak memiliki otak."];
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
let scheduleTimer: ReturnType<typeof setInterval> | undefined;
let scheduleSocket: Socket;
type Schedule = { id: string; chatId: string; text: string; nextRun: string; recurring?: "daily" | "weekly" };

export function initializeSchedules(sock: Socket) {
  scheduleSocket = sock;
  if (scheduleTimer) return;
  scheduleTimer = setInterval(async () => {
    const all = await store<Schedule[]>("schedules", []);
    const now = Date.now(); let changed = false;
    for (const job of all) {
      if (new Date(job.nextRun).getTime() > now) continue;
      try {
        await scheduleSocket.sendMessage(job.chatId, { text: `🔔 *Pengingat!*\n${job.text}` });
        if (job.recurring) {
          const next = new Date(job.nextRun);
          next.setDate(next.getDate() + (job.recurring === "daily" ? 1 : 7));
          job.nextRun = next.toISOString();
        } else {
          job.nextRun = new Date(8640000000000000).toISOString();
        }
        changed = true;
      } catch {
        // Keep the due job so a later scheduler tick can retry delivery.
      }
    }
    const remaining = all.filter((j) => new Date(j.nextRun).getTime() < 8640000000000000);
    if (changed) await save("schedules", remaining);
  }, 15_000);
}

function scheduleDate(raw: string) {
  const value = raw.trim().toLowerCase();
  let match = value.match(/^(\d+(?:\.\d+)?)\s*(menit|jam)\s+lagi$/);
  if (match) return { date: new Date(Date.now() + Number(match[1]) * (match[2] === "jam" ? 3600000 : 60000)) };
  match = value.match(/^besok(?:\s+jam)?\s+(\d{1,2})(?::(\d{2}))?$/);
  if (match) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(Number(match[1]), Number(match[2] ?? 0), 0, 0); return { date: d }; }
  match = value.match(/^setiap\s+hari(?:\s+jam)?\s+(\d{1,2})(?::(\d{2}))?$/);
  if (match) { const d = new Date(); d.setHours(Number(match[1]), Number(match[2] ?? 0), 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return { date: d, recurring: "daily" as const }; }
  return undefined;
}

function zodiac(day: number, month: number) {
  const signs: Array<[number, string]> = [[20, "Aquarius"], [19, "Pisces"], [20, "Aries"], [20, "Taurus"], [21, "Gemini"], [21, "Cancer"], [23, "Leo"], [23, "Virgo"], [23, "Libra"], [23, "Scorpio"], [22, "Sagittarius"], [22, "Capricorn"]];
  return day < signs[(month + 10) % 12][0] ? signs[(month + 11) % 12][1] : signs[(month + 10) % 12][1];
}

export async function handleFeatureCommand(sock: Socket, message: Message, name: string, args: string[]) {
  const id = chat(message);
  const input = args.join(" ").trim().slice(0, MAX_TEXT);
  if (name === "cuaca" || name === "weather") {
    if (!input) return say(sock, message, "Contoh: .cuaca Jakarta");
    try {
      const res = await request(`https://wttr.in/${encodeURIComponent(input)}?format=j1`);
      if (!res.ok) throw new Error();
      const data = await res.json() as any; const cur = data.current_condition?.[0]; const area = data.nearest_area?.[0];
      if (!cur || !area) throw new Error();
      return say(sock, message, `🌤️ Cuaca di ${area.areaName?.[0]?.value ?? input}\nKondisi: ${cur.weatherDesc?.[0]?.value ?? "-"}\nSuhu: ${cur.temp_C}°C (terasa ${cur.FeelsLikeC}°C)\nKelembapan: ${cur.humidity}%\nAngin: ${cur.windspeedKmph} km/jam`);
    } catch { return say(sock, message, "Cuaca sedang tidak tersedia. Coba lagi nanti."); }
  }
  if (name === "wiki" || name === "wikipedia") {
    if (!input) return say(sock, message, "Contoh: .wiki Republik Indonesia");
    try {
      const res = await request(`https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(input)}`);
      if (!res.ok) return say(sock, message, "Artikel Wikipedia tidak ditemukan.");
      const d = await res.json() as any;
      return say(sock, message, `📖 ${d.title}\n\n${d.extract?.slice(0, 1800) ?? "Ringkasan tidak tersedia."}\n\n🔗 ${d.content_urls?.desktop?.page ?? ""}`);
    } catch { return say(sock, message, "Wikipedia sedang tidak tersedia. Coba lagi nanti."); }
  }
  if (name === "kurs" || name === "convert" || name === "currency") {
    const [amountRaw, from, to] = args; const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0 || !from || !to || amount > 1e12) return say(sock, message, "Format: .kurs 100 USD IDR");
    try {
      const res = await request(`https://open.er-api.com/v6/latest/${encodeURIComponent(from.toUpperCase())}`);
      const d = await res.json() as any; const rate = d.rates?.[to.toUpperCase()];
      if (!res.ok || !rate) throw new Error();
      return say(sock, message, `💱 ${amount} ${from.toUpperCase()} = *${(amount * rate).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${to.toUpperCase()}*`);
    } catch { return say(sock, message, "Kode mata uang tidak valid atau layanan kurs sedang tidak tersedia."); }
  }
  if (name === "qr" || name === "qrcode") {
    if (!input) return say(sock, message, "Contoh: .qr https://example.com");
    try { return await sock.sendMessage(id, { image: await QRCode.toBuffer(input, { width: 512, margin: 1 }), caption: `📱 QR code untuk: ${input}` }, { quoted: message }); } catch { return say(sock, message, "QR code gagal dibuat."); }
  }
  if (name === "short" || name === "shortlink" || name === "pendekin") {
    const url = args[0];
    if (!url || url.length > 1500 || !/^https?:\/\//i.test(url)) return say(sock, message, "Contoh: .short https://contoh.com/link-panjang");
    try { const res = await request(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`); const result = (await res.text()).trim(); if (!res.ok || result.startsWith("Error")) throw new Error(); return say(sock, message, `🔗 ${result}`); } catch { return say(sock, message, "URL gagal diperpendek. Coba lagi nanti."); }
  }
  if (name === "poll" || name === "polling" || name === "voting") {
    const parts = input.split("|").map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3 || parts.length > 13 || parts[0].length > 200) return say(sock, message, "Format: .poll pertanyaan|opsi 1|opsi 2 (maksimal 12 opsi)");
    return sock.sendMessage(id, { poll: { name: parts[0], values: parts.slice(1), selectableCount: 1 } }, { quoted: message });
  }
  if (name === "pantun") return say(sock, message, `📜 *Pantun:*\n\n${pick(pantun)}`);
  if (name === "fakta" || name === "fact") {
    try { const r = await request("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"); const d = await r.json() as any; return say(sock, message, `🧠 *Fakta unik:*\n${String(d.text).slice(0, 1000)}`); } catch { return say(sock, message, `🧠 *Fakta unik:*\n${pick(facts)}`); }
  }
  if (name === "meme") {
    try { const r = await request("https://meme-api.com/gimme"); const d = await r.json() as any; if (!d.url) throw new Error(); return sock.sendMessage(id, { image: { url: d.url }, caption: `😂 ${String(d.title ?? "Meme").slice(0, 200)}` }, { quoted: message }); } catch { return say(sock, message, "Meme sedang tidak tersedia. Coba lagi nanti."); }
  }
  if (name === "umur" || name === "age") {
    const m = (args[0] ?? "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if (!m) return say(sock, message, "Format: .umur DD-MM-YYYY");
    const birth = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])); const now = new Date();
    if (birth.getFullYear() !== Number(m[3]) || birth.getMonth() !== Number(m[2]) - 1 || birth > now) return say(sock, message, "Tanggal tidak valid.");
    let years = now.getFullYear() - birth.getFullYear(); if (new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) > now) years--;
    return say(sock, message, `🎂 Umur kamu: ${years} tahun`);
  }
  if (name === "zodiak" || name === "zodiac") { const m = (args[0] ?? "").match(/^(\d{1,2})-(\d{1,2})$/); if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) return say(sock, message, "Format: .zodiak DD-MM"); return say(sock, message, `♈ Zodiak kamu: *${zodiac(+m[1], +m[2])}*`); }
  if (name === "pass" || name === "password" || name === "genpass") { const length = Math.min(Math.max(Number(args[0]) || 12, 4), 64); const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"; let result = ""; for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)]; return say(sock, message, `🔐 Password (${length} karakter):\n\`\`\`${result}\`\`\``); }
  if (name === "pilih" || name === "choose" || name === "random") { const options = input.split("|").filter(Boolean); return options.length < 2 ? say(sock, message, "Contoh: .pilih nasi|mie|puasa") : say(sock, message, `🎯 Pilihan: *${pick(options)}*`); }
  if (name === "dadu" || name === "dice") return say(sock, message, `🎲 Hasil dadu: *${1 + Math.floor(Math.random() * 6)}*`);
  if (name === "koin" || name === "coinflip" || name === "flip") return say(sock, message, `🪙 Hasil: *${Math.random() < .5 ? "Angka" : "Gambar"}*`);
  if (name === "note" || name === "catatan") return notes(sock, message, args);
  if (name === "todo" || name === "tugas") return todos(sock, message, args);
  if (name === "reminder" || name === "ingatkan" || name === "remindme") return reminder(sock, message, args);
  if (name === "jadwal" || name === "schedule" || name === "ingatkanbesok") return schedule(sock, message, args);
  return false;
}

async function schedule(sock: Socket, msg: Message, args: string[]) {
  const id = chat(msg); const raw = args.join(" "); const all = await store<Schedule[]>("schedules", []);
  if (!raw || raw.toLowerCase() === "list") {
    const own = all.filter((j) => j.chatId === id);
    return say(sock, msg, own.length ? `📅 *Jadwal aktif:*\n\n${own.map((j, i) => `${i + 1}. [${j.id}] ${j.text}\n🕐 ${new Date(j.nextRun).toLocaleString("id-ID")}`).join("\n\n")}` : "Belum ada jadwal aktif.\n.jadwal besok jam 8 | pesan");
  }
  if (raw.toLowerCase().startsWith("hapus ")) {
    const wanted = raw.split(/\s+/)[1]; const index = all.findIndex((j) => j.id === wanted && j.chatId === id);
    if (index < 0) return say(sock, msg, "Jadwal tidak ditemukan.");
    all.splice(index, 1); await save("schedules", all); return say(sock, msg, "✅ Jadwal dibatalkan.");
  }
  const [when, ...rest] = raw.split("|"); const text = rest.join("|").trim().slice(0, MAX_TEXT); const parsed = scheduleDate(when);
  if (!parsed || !text || parsed.date.getTime() <= Date.now()) return say(sock, msg, "Format: .jadwal besok jam 8 | pesan\nAtau: .jadwal 30 menit lagi | pesan");
  const job: Schedule = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, chatId: id, text, nextRun: parsed.date.toISOString(), recurring: parsed.recurring };
  all.push(job); await save("schedules", all); initializeSchedules(sock);
  return say(sock, msg, `✅ Jadwal dibuat untuk ${parsed.date.toLocaleString("id-ID")}.\n🆔 ${job.id}`);
}

async function notes(sock: Socket, msg: Message, args: string[]) {
  const id = chat(msg); const all = await store<Record<string, { text: string }[]>>("notes", {}); const list = all[id] ?? []; const sub = (args[0] ?? "").toLowerCase();
  if (sub === "tambah" || sub === "add") { const text = args.slice(1).join(" ").slice(0, MAX_TEXT); if (!text) return say(sock, msg, "Contoh: .note tambah beli galon"); list.push({ text }); all[id] = list; await save("notes", all); return say(sock, msg, `✅ Catatan disimpan (total: ${list.length})`); }
  if (sub === "hapus" || sub === "delete") { const n = Number(args[1]); if (!Number.isInteger(n) || !list[n - 1]) return say(sock, msg, "Nomor catatan tidak valid."); const removed = list.splice(n - 1, 1)[0]; all[id] = list; await save("notes", all); return say(sock, msg, `🗑️ Catatan dihapus: "${removed.text}"`); }
  return say(sock, msg, list.length ? `📝 *Catatan:*\n\n${list.map((n, i) => `${i + 1}. ${n.text}`).join("\n")}` : "Belum ada catatan.\n.note tambah <teks>");
}
async function todos(sock: Socket, msg: Message, args: string[]) {
  const id = chat(msg); const all = await store<Record<string, { text: string; done: boolean }[]>>("todos", {}); const list = all[id] ?? []; const sub = (args[0] ?? "").toLowerCase();
  if (sub === "tambah" || sub === "add") { const text = args.slice(1).join(" ").slice(0, MAX_TEXT); if (!text) return say(sock, msg, "Contoh: .todo tambah kerjakan laporan"); list.push({ text, done: false }); all[id] = list; await save("todos", all); return say(sock, msg, `✅ Tugas ditambahkan (total: ${list.length})`); }
  const n = Number(args[1]); if (sub === "selesai" || sub === "done") { if (!list[n - 1]) return say(sock, msg, "Nomor tugas tidak valid."); list[n - 1].done = true; all[id] = list; await save("todos", all); return say(sock, msg, "🎉 Tugas ditandai selesai."); }
  if (sub === "hapus" || sub === "delete") { if (!list[n - 1]) return say(sock, msg, "Nomor tugas tidak valid."); list.splice(n - 1, 1); all[id] = list; await save("todos", all); return say(sock, msg, "🗑️ Tugas dihapus."); }
  return say(sock, msg, list.length ? `✅ *Daftar tugas:*\n\n${list.map((t, i) => `${i + 1}. ${t.done ? "✔️" : "⬜"} ${t.text}`).join("\n")}` : "Belum ada tugas.\n.todo tambah <teks>");
}
async function reminder(sock: Socket, msg: Message, args: string[]) {
  const minutes = Number(args[0]);
  const text = args.slice(1).join(" ").slice(0, MAX_TEXT);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440 || !text) {
    return say(sock, msg, "Format: .reminder <menit> <pesan> (maksimal 1440 menit)");
  }
  const all = await store<Schedule[]>("schedules", []);
  const job: Schedule = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    chatId: chat(msg),
    text,
    nextRun: new Date(Date.now() + minutes * 60_000).toISOString(),
  };
  all.push(job);
  await save("schedules", all);
  initializeSchedules(sock);
  return say(sock, msg, `⏰ Oke, aku ingatkan dalam ${minutes} menit lagi. Jadwal tersimpan.`);
}