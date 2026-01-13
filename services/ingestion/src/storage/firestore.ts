import { Firestore } from "@google-cloud/firestore";
import { config } from "../config.js";

export const db = new Firestore(
  config.firestoreProjectId
    ? {
        projectId: config.firestoreProjectId,
      }
    : undefined,
);
