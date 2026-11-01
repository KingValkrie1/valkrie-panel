import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsappBot } from "./whatsapp-bot";

const port = Number(process.env.PORT || 3000);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env.PORT || port}"`);
}

void startWhatsappBot();

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host: "0.0.0.0", port }, "Server listening");
});
