import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import {
  GetBotConversationParams,
  SimulateBotMessageBody,
  UpdateBotConfigBody,
} from "@workspace/api-zod";
import {
  activityTable,
  botConfigTable,
  conversationsTable,
  db,
  messagesTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_CONFIG = {
  name: "Nara",
  description: "Asisten WhatsApp yang ramah untuk membantu pelanggan.",
  systemPrompt:
    "Kamu adalah asisten WhatsApp yang ramah, singkat, dan membantu. Jawab dalam Bahasa Indonesia. Jika tidak yakin, katakan dengan jujur dan arahkan pengguna untuk menghubungi tim.",
  greeting: "Halo! Saya Nara. Ada yang bisa saya bantu hari ini?",
  fallbackMessage:
    "Maaf, saya belum bisa menjawab itu dengan tepat. Tim kami akan membantu Anda segera.",
  model: "gpt-4.1-mini",
  isActive: true,
  whatsappNumber: null,
};

type BotConfigRow = typeof botConfigTable.$inferSelect;
let configPromise: Promise<BotConfigRow> | undefined;

type AiFailureCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "insufficient_quota"
  | "rate_limit"
  | "model_unavailable"
  | "provider_unavailable"
  | "network_error"
  | "provider_error";

export class AiProviderError extends Error {
  constructor(
    readonly code: AiFailureCode,
    readonly status?: number,
  ) {
    super(code);
    this.name = "AiProviderError";
  }
}

export function aiFailureMessage(error: unknown) {
  if (!(error instanceof AiProviderError)) {
    return "Layanan AI sedang bermasalah. Coba lagi sebentar.";
  }

  switch (error.code) {
    case "missing_api_key":
      return "AI belum dikonfigurasi. Pemilik bot perlu mengisi OPENAI_API_KEY di file .env.";
    case "invalid_api_key":
      return "Koneksi OpenAI ditolak. Pemilik bot perlu memeriksa atau memperbarui secret OPENAI_API_KEY.";
    case "insufficient_quota":
      return "Kuota atau billing OpenAI sudah habis. Pemilik bot perlu mengaktifkan billing atau menambah limit pada akun OpenAI.";
    case "rate_limit":
      return "OpenAI sedang membatasi jumlah permintaan. Tunggu sebentar lalu coba lagi.";
    case "model_unavailable":
      return "Model AI yang dipilih tidak tersedia untuk akun ini. Pemilik bot perlu memilih model lain di pengaturan.";
    case "provider_unavailable":
      return "Layanan OpenAI sedang mengalami gangguan. Coba lagi beberapa saat.";
    case "network_error":
      return "Server bot tidak dapat terhubung ke layanan AI. Coba lagi beberapa saat.";
    default:
      return "OpenAI gagal memproses pesan. Periksa pengaturan model dan coba lagi.";
  }
}

async function ensureConfig() {
  if (!process.env.DATABASE_URL) return DEFAULT_CONFIG as BotConfigRow;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    const existing = await db.select().from(botConfigTable).limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(botConfigTable)
      .values(DEFAULT_CONFIG)
      .returning();
    await db.insert(activityTable).values({
      type: "config",
      text: "Bot Nara siap dikonfigurasi",
    });
    return created;
  })();
  try {
    return await configPromise;
  } catch (error) {
    logger.warn({ err: error }, "Database unavailable; using in-memory bot defaults");
    configPromise = Promise.resolve(DEFAULT_CONFIG as BotConfigRow);
    return configPromise;
  }
}

async function getOrCreateConversation(
  phoneNumber: string,
  contactName: string,
) {
  const existing = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.phoneNumber, phoneNumber))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(conversationsTable)
    .values({ phoneNumber, contactName })
    .returning();
  return created;
}

function configResponse(config: BotConfigRow) {
  return {
    name: config.name,
    description: config.description,
    systemPrompt: config.systemPrompt,
    greeting: config.greeting,
    fallbackMessage: config.fallbackMessage,
    model: config.model,
    isActive: config.isActive,
    whatsappNumber: config.whatsappNumber,
    updatedAt: config.updatedAt.toISOString(),
  };
}

async function generateReply(
  config: BotConfigRow,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiProviderError("missing_api_key");
  const baseURL = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.groq.com/openai/v1"
  ).replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || "openai/gpt-oss-20b";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          { role: "system", content: config.systemPrompt },
          ...history,
        ],
      }),
      signal: controller.signal,
    });
  } catch {
    throw new AiProviderError("network_error");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; type?: string };
    } | null;
    const providerCode = payload?.error?.code ?? payload?.error?.type ?? "";
    let code: AiFailureCode = "provider_error";
    if (response.status === 401 || response.status === 403) code = "invalid_api_key";
    else if (
      response.status === 429 &&
      /quota|billing|insufficient/i.test(providerCode)
    ) code = "insufficient_quota";
    else if (response.status === 429) code = "rate_limit";
    else if (response.status === 404 || /model_not_found/i.test(providerCode)) {
      code = "model_unavailable";
    } else if (response.status >= 500) code = "provider_unavailable";
    throw new AiProviderError(code, response.status);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() || config.fallbackMessage;
}

router.get("/bot/overview", async (req, res, next) => {
  try {
    const config = await ensureConfig();
    const [conversationTotal, messagesToday, recentActivity] = await Promise.all([
      db.select({ value: count() }).from(conversationsTable),
      db
        .select({ value: count() })
        .from(messagesTable)
        .where(gte(messagesTable.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))),
      db
        .select()
        .from(activityTable)
        .orderBy(desc(activityTable.createdAt))
        .limit(6),
    ]);

    res.json({
      botStatus: config.whatsappNumber
        ? config.isActive
          ? "active"
          : "paused"
        : "not_connected",
      totalConversations: Number(conversationTotal[0]?.value ?? 0),
      messagesToday: Number(messagesToday[0]?.value ?? 0),
      responseRate: Number(messagesToday[0]?.value ?? 0) > 0 ? 98 : 0,
      recentActivity: recentActivity.map((item) => ({
        id: item.id,
        type: item.type,
        text: item.text,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/bot/config", async (_req, res, next) => {
  try {
    res.json(configResponse(await ensureConfig()));
  } catch (error) {
    next(error);
  }
});

router.patch("/bot/config", async (req, res, next) => {
  try {
    const input = UpdateBotConfigBody.parse(req.body);
    const current = await ensureConfig();
    const [updated] = await db
      .update(botConfigTable)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(botConfigTable.id, current.id))
      .returning();
    await db.insert(activityTable).values({
      type: "config",
      text: "Konfigurasi bot diperbarui",
    });
    res.json(configResponse(updated));
  } catch (error) {
    next(error);
  }
});

router.get("/bot/conversations", async (_req, res, next) => {
  try {
    const conversations = await db
      .select()
      .from(conversationsTable)
      .orderBy(desc(conversationsTable.lastMessageAt));
    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const [lastMessage] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, conversation.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1);
        return {
          id: conversation.id,
          contactName: conversation.contactName,
          phoneNumber: conversation.phoneNumber,
          lastMessage: lastMessage?.content ?? "Belum ada pesan",
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          unreadCount: conversation.unreadCount,
          status: conversation.status,
        };
      }),
    );
    res.json(summaries);
  } catch (error) {
    next(error);
  }
});

router.get("/bot/conversations/:id", async (req, res, next) => {
  try {
    const { id } = GetBotConversationParams.parse(req.params);
    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .limit(1);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt));
    res.json({
      id: conversation.id,
      contactName: conversation.contactName,
      phoneNumber: conversation.phoneNumber,
      status: conversation.status,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/bot/simulate", async (req, res, next) => {
  try {
    const input = SimulateBotMessageBody.parse(req.body);
    const config = await ensureConfig();
    const conversation = input.conversationId
      ? (
          await db
            .select()
            .from(conversationsTable)
            .where(eq(conversationsTable.id, input.conversationId))
            .limit(1)
        )[0]
      : await getOrCreateConversation("test-console", "Test Console");

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const previous = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(asc(messagesTable.createdAt))
      .limit(20);
    const history = [
      ...previous.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
      { role: "user" as const, content: input.message },
    ];
    let reply: string;
    try {
      reply = config.isActive
        ? await generateReply(config, history)
        : config.fallbackMessage;
    } catch (error) {
      req.log.warn({ err: error }, "AI reply failed; using configured fallback");
      res.status(503).json({
        code: error instanceof AiProviderError ? error.code : "ai_unavailable",
        error: aiFailureMessage(error),
      });
      return;
    }

    const now = new Date();
    try {
      await db.insert(messagesTable).values([
        { conversationId: conversation.id, role: "user", content: input.message },
        { conversationId: conversation.id, role: "assistant", content: reply },
      ]);
      await db
        .update(conversationsTable)
        .set({ lastMessageAt: now })
        .where(eq(conversationsTable.id, conversation.id));
      await db.insert(activityTable).values({
        type: "message",
        text: `Bot membalas pesan dari ${conversation.contactName}`,
      });
    } catch (error) {
      req.log.warn({ err: error }, "AI reply created but conversation history could not be saved");
    }
    res.json({
      reply,
      conversationId: conversation.id,
      createdAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export { ensureConfig, generateReply, getOrCreateConversation };
export default router;
