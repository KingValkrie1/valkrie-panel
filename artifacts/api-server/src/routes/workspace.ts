import { Router, type IRouter } from "express";
import { and, asc, count, desc, gte, ilike, or } from "drizzle-orm";
import {
  activityTable,
  botConfigTable,
  conversationsTable,
  db,
  messagesTable,
} from "@workspace/db";
import { getWhatsappStatus } from "../whatsapp-bot";

const router: IRouter = Router();

function iso(date: Date) {
  return date.toISOString();
}

router.get("/workspace/summary", async (_req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [config, conversationTotal, messageTotal, messagesToday, aiReplies, recentActivity] = await Promise.all([
      db.select().from(botConfigTable).limit(1),
      db.select({ value: count() }).from(conversationsTable),
      db.select({ value: count() }).from(messagesTable),
      db.select({ value: count() }).from(messagesTable).where(gte(messagesTable.createdAt, today)),
      db.select({ value: count() }).from(messagesTable).where(and(gte(messagesTable.createdAt, today), ilike(messagesTable.role, "assistant"))),
      db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(20),
    ]);
    const whatsapp = getWhatsappStatus();
    res.json({
      role: "authenticated",
      stats: {
        totalUsers: 1,
        activeUsers: 1,
        totalConversations: Number(conversationTotal[0]?.value ?? 0),
        totalMessages: Number(messageTotal[0]?.value ?? 0),
        messagesToday: Number(messagesToday[0]?.value ?? 0),
        aiRepliesToday: Number(aiReplies[0]?.value ?? 0),
        responseRate: Number(messageTotal[0]?.value ?? 0) > 0 ? 98 : 0,
      },
      bot: {
        name: config[0]?.name ?? "WA AI Bot",
        active: Boolean(config[0]?.isActive),
        model: config[0]?.model ?? "gpt-4.1-mini",
      },
      whatsapp: {
        status: whatsapp.status,
        connectedNumber: whatsapp.connectedNumber,
        hasQr: Boolean(whatsapp.qrImage),
      },
      api: {
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        openaiKeyMasked: process.env.OPENAI_API_KEY ? "Configured securely" : "Not configured",
      },
      activity: recentActivity.map((item) => ({
        id: item.id,
        type: item.type,
        text: item.text,
        createdAt: iso(item.createdAt),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/workspace/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim().slice(0, 120);
    if (!query) {
      res.json({ conversations: [], messages: [], activity: [] });
      return;
    }
    const pattern = `%${query}%`;
    const [conversations, messages, activity] = await Promise.all([
      db.select().from(conversationsTable).where(or(ilike(conversationsTable.contactName, pattern), ilike(conversationsTable.phoneNumber, pattern))).orderBy(desc(conversationsTable.lastMessageAt)).limit(20),
      db.select().from(messagesTable).where(ilike(messagesTable.content, pattern)).orderBy(desc(messagesTable.createdAt)).limit(20),
      db.select().from(activityTable).where(ilike(activityTable.text, pattern)).orderBy(desc(activityTable.createdAt)).limit(20),
    ]);
    res.json({
      conversations: conversations.map((item) => ({ id: item.id, label: item.contactName, detail: item.phoneNumber, createdAt: iso(item.lastMessageAt) })),
      messages: messages.map((item) => ({ id: item.id, conversationId: item.conversationId, label: item.content, detail: item.role, createdAt: iso(item.createdAt) })),
      activity: activity.map((item) => ({ id: item.id, label: item.text, detail: item.type, createdAt: iso(item.createdAt) })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/workspace/export", async (_req, res, next) => {
  try {
    const [config, conversations, messages, activity] = await Promise.all([
      db.select().from(botConfigTable),
      db.select().from(conversationsTable),
      db.select().from(messagesTable),
      db.select().from(activityTable).orderBy(asc(activityTable.createdAt)),
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="wa-bot-studio-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      config,
      conversations,
      messages,
      activity,
    });
  } catch (error) {
    next(error);
  }
});

export default router;