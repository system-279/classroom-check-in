import type { Mailer, EmailMessage } from "./mailer.interface.js";

export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    console.log("=".repeat(60));
    console.log("[ConsoleMailer] Email sent:");
    console.log(`  To: ${message.to}`);
    console.log(`  Subject: ${message.subject}`);
    console.log(`  Body:`);
    console.log(message.body.split("\n").map((l) => `    ${l}`).join("\n"));
    console.log("=".repeat(60));
  }
}
