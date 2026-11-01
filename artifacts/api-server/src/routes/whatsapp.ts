import { Router, type IRouter } from "express";
import { ReceiveWhatsappMessageBody } from "@workspace/api-zod";
import { db, messagesTable, activityTable, conversationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureConfig, generateReply, getOrCreateConversation } from "./bot";

const router: IRouter = Router();

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

router.post("/whatsapp/webhook", async (req, res, next) => {
  try {
    const parsed = ReceiveWhatsappMessageBody.safeParse(req.body);
    const input = parsed.success ? parsed.data : {};
    const incomingMessage = input.Body?.trim();
    const from = input.From?.trim() || "whatsapp:unknown";
    const contactName = input.ProfileName?.trim() || from.replace("whatsapp:", "");

    res.type("text/xml");
    if (!incomingMessage) {
      res.send("<Response></Response>");
      return;
    }

    const config = await ensureConfig();
    const conversation = await getOrCreateConversation(from, contactName);
    const previous = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id))
      .orderBy(messagesTable.createdAt)
      .limit(20);
    const history = [
      ...previous.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
      { role: "user" as const, content: incomingMessage },
    ];

    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "user",
      content: incomingMessage,
    });

    let reply = config.greeting;
    if (config.isActive) {
      try {
        reply = await generateReply(config, history);
      } catch (error) {
        req.log.warn({ err: error }, "WhatsApp AI reply failed; using fallback");
        reply = config.fallbackMessage;
      }
    } else {
      reply = config.fallbackMessage;
    }

    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      content: reply,
    });
    await db
      .update(conversationsTable)
      .set({ lastMessageAt: new Date(), unreadCount: conversation.unreadCount + 1 })
      .where(eq(conversationsTable.id, conversation.id));
    await db.insert(activityTable).values({
      type: "message",
      text: `Pesan WhatsApp baru dari ${contactName}`,
    });

    res.send(`<Response><Message>${escapeXml(reply)}</Message></Response>`);
  } catch (error) {
    next(error);
  }
});

export default router;