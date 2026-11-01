import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
const requestWindows = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 180;

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  current.count += 1;
  if (current.count > RATE_LIMIT) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }
  next();
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
} else {
  logger.info("CLERK_SECRET_KEY not set; running without Clerk authentication");
}

app.use("/api", rateLimit);
app.use("/api", router);

// Serve the Vite build from artifacts/wa-bot-studio/dist/public.
// Resolve from the compiled API module so this works regardless of process.cwd().
const apiDistDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(apiDistDir, "../../wa-bot-studio/dist/public");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

app.use(express.static(frontendDistPath, { index: false, maxAge: "1h" }));
// Express 5 requires a RegExp (rather than the old '*' string wildcard).
// Exclude /api and /api/* so unknown API endpoints remain normal API 404s.
app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
  res.sendFile(frontendIndexPath, (err) => {
    if (err) next(err);
  });
});

export default app;
