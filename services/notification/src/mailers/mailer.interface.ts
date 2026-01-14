export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
