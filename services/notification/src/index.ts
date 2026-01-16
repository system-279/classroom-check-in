import express from "express";
import { db } from "./storage/firestore.js";
import { loadConfig } from "./config.js";
import { runHandler } from "./run-handler.js";
import { ConsoleMailer } from "./mailers/console-mailer.js";
import { GmailMailer } from "./mailers/gmail-mailer.js";
import type { Mailer } from "./mailers/mailer.interface.js";

const config = loadConfig();

function createMailer(): Mailer {
  switch (config.mailProvider) {
    case "gmail":
      if (!config.gmailDelegateUser) {
        console.warn(
          "[init] GMAIL_DELEGATE_USER not set, falling back to console mailer",
        );
        return new ConsoleMailer();
      }
      return new GmailMailer(config.mailFrom, config.gmailDelegateUser);
    case "console":
    default:
      return new ConsoleMailer();
  }
}

const mailer = createMailer();

const app = express();
app.use(express.json());

// ヘルスチェック（複数パスで提供）
app.get(["/health", "/healthz"], (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/run", async (req, res, next) => {
  try {
    await runHandler(req, res, db, mailer, config.mailFrom);
  } catch (error) {
    next(error);
  }
});

app.listen(config.port, () => {
  console.log(`Notification service listening on :${config.port}`);
  console.log(`  Mail provider: ${config.mailProvider}`);
  console.log(`  Mail from: ${config.mailFrom}`);
});
