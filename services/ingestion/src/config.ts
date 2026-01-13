export type SyncTask = "classroom-sync" | "forms-sync";

export const config = {
  firestoreProjectId:
    process.env.FIRESTORE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    null,
  classroom: {
    pageSize: Number(process.env.CLASSROOM_PAGE_SIZE || 100),
    includeArchived: process.env.CLASSROOM_INCLUDE_ARCHIVED === "true",
    syncStudents: process.env.CLASSROOM_SYNC_STUDENTS !== "false",
    syncTeachers: process.env.CLASSROOM_SYNC_TEACHERS !== "false",
  },
  forms: {
    pageSize: Number(process.env.FORMS_PAGE_SIZE || 200),
  },
  google: {
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    adminSubject: process.env.GOOGLE_WORKSPACE_ADMIN_SUBJECT || null,
  },
};
