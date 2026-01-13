import fs from "node:fs";
import { google } from "googleapis";

export type AuthOptions = {
  scopes: string[];
  credentialsPath: string | null;
  adminSubject: string | null;
};

export const createAuthClient = async (options: AuthOptions) => {
  const { scopes, credentialsPath, adminSubject } = options;

  if (adminSubject && !credentialsPath) {
    throw new Error(
      "GOOGLE_WORKSPACE_ADMIN_SUBJECT requires GOOGLE_APPLICATION_CREDENTIALS",
    );
  }

  if (adminSubject && credentialsPath) {
    const raw = fs.readFileSync(credentialsPath, "utf8");
    const key = JSON.parse(raw) as {
      client_email: string;
      private_key: string;
    };

    const client = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes,
      subject: adminSubject,
    });
    await client.authorize();
    return client;
  }

  const auth = new google.auth.GoogleAuth({
    scopes,
  });

  return auth.getClient();
};
