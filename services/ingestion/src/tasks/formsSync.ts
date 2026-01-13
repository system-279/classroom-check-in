import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { google } from "googleapis";
import { config } from "../config.js";
import { createAuthClient } from "../google/auth.js";
import { db } from "../storage/firestore.js";

const formsScopes = [
  "https://www.googleapis.com/auth/forms.responses.readonly",
];

type SyncStats = {
  forms: number;
  responses: number;
};

const listResponses = async (formId: string, since?: Date) => {
  const auth = await createAuthClient({
    scopes: formsScopes,
    credentialsPath: config.google.credentialsPath,
    adminSubject: config.google.adminSubject,
  });

  const forms = google.forms({ version: "v1", auth });
  const responses: NonNullable<
    Awaited<ReturnType<typeof forms.forms.responses.list>>["data"]["responses"]
  > = [];

  let pageToken: string | undefined;
  const filter = since
    ? `timestamp > ${since.toISOString()}`
    : undefined;

  do {
    const res = await forms.forms.responses.list({
      formId,
      pageSize: config.forms.pageSize,
      pageToken,
      filter,
    });

    if (res.data.responses) {
      responses.push(...res.data.responses);
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return responses;
};

export const syncForms = async () => {
  const stats: SyncStats = { forms: 0, responses: 0 };

  const mappingsSnap = await db
    .collection("formMappings")
    .where("active", "==", true)
    .get();

  for (const mappingDoc of mappingsSnap.docs) {
    const mapping = mappingDoc.data();
    const formId = mapping.formId as string | undefined;
    if (!formId) {
      continue;
    }

    stats.forms += 1;

    const lastSyncedAt = mapping.lastSyncedAt
      ? (mapping.lastSyncedAt as Timestamp).toDate()
      : undefined;

    const responses = await listResponses(formId, lastSyncedAt);

    for (const response of responses) {
      if (!response.responseId) {
        continue;
      }
      const responseId = response.responseId;
      const docId = `${formId}_${responseId}`;

      await db.collection("formResponses").doc(docId).set(
        {
          formId,
          responseId,
          courseId: mapping.courseId ?? null,
          createTime: response.createTime ?? null,
          lastSubmittedTime: response.lastSubmittedTime ?? null,
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      stats.responses += 1;
    }

    await mappingDoc.ref.update({
      lastSyncedAt: FieldValue.serverTimestamp(),
    });
  }

  await db.collection("syncRuns").add({
    task: "forms-sync",
    stats,
    completedAt: FieldValue.serverTimestamp(),
  });

  return stats;
};
