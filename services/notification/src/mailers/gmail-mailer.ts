import { google } from "googleapis";
import type { Mailer, EmailMessage } from "./mailer.interface.js";

export class GmailMailer implements Mailer {
  private readonly from: string;
  private readonly delegateUser: string;

  constructor(from: string, delegateUser: string) {
    this.from = from;
    this.delegateUser = delegateUser;
  }

  private async getAuth() {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
    });

    const client = await auth.getClient();

    // ドメイン全体の委任を使用する場合、委任ユーザーを設定
    if (this.delegateUser && "subject" in client) {
      (client as { subject?: string }).subject = this.delegateUser;
    }

    return client;
  }

  private createRawEmail(message: EmailMessage): string {
    const emailLines = [
      `From: ${this.from}`,
      `To: ${message.to}`,
      `Subject: =?UTF-8?B?${Buffer.from(message.subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(message.body).toString("base64"),
    ];

    const email = emailLines.join("\r\n");
    return Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async send(message: EmailMessage): Promise<void> {
    const auth = await this.getAuth();
    const gmail = google.gmail({ version: "v1", auth: auth as Parameters<typeof google.gmail>[0]["auth"] });

    const raw = this.createRawEmail(message);

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
      },
    });

    console.log(`[GmailMailer] Email sent to ${message.to}`);
  }
}
