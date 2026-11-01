import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
import botRouter from "./bot";
import whatsappRouter from "./whatsapp";
import workspaceRouter from "./workspace";
import { getWhatsappStatus } from "../whatsapp-bot";

const router: IRouter = Router();

router.use(healthRouter);

const requireAuth: RequestHandler = (req, res, next) => {
  if (!process.env.CLERK_SECRET_KEY) {
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

router.get("/bot/whatsapp-status", requireAuth, (_req, res) => {
  const status = getWhatsappStatus();
  // Pairing QR codes are account-linking credentials. Keep them out of the
  // unauthenticated Termux/local-preview API response.
  if (!process.env.CLERK_SECRET_KEY) {
    res.json({ ...status, qr: null, qrImage: null });
    return;
  }
  res.json(status);
});

if (process.env.DATABASE_URL) {
  router.use(requireAuth, botRouter);
  router.use(requireAuth, workspaceRouter);
  router.use(whatsappRouter);
} else {
  const databaseUnavailable: RequestHandler = (_req, res) => {
    res.status(503).json({ error: "This dashboard endpoint requires DATABASE_URL." });
  };
  router.use(["/bot", "/workspace", "/whatsapp"], databaseUnavailable);
}

export default router;
