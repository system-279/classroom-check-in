export type MailProvider = "gmail" | "console";

export interface Config {
  mailProvider: MailProvider;
  mailFrom: string;
  gmailDelegateUser?: string;
  port: number;
}

function parsePort(portEnv: string | undefined): number {
  const portRaw = portEnv || "8080";
  const port = parseInt(portRaw, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${portRaw}`);
  }
  return port;
}

export function loadConfig(): Config {
  const mailProvider = (process.env.MAIL_PROVIDER || "console") as MailProvider;

  if (mailProvider !== "gmail" && mailProvider !== "console") {
    throw new Error(`Invalid MAIL_PROVIDER: ${mailProvider}`);
  }

  return {
    mailProvider,
    mailFrom: process.env.MAIL_FROM || "noreply@example.com",
    gmailDelegateUser: process.env.GMAIL_DELEGATE_USER,
    port: parsePort(process.env.PORT),
  };
}
