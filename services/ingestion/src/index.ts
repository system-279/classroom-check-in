import express from "express";
import { config, type SyncTask } from "./config.js";
import { syncClassroom } from "./tasks/classroomSync.js";
import { syncForms } from "./tasks/formsSync.js";

const app = express();
app.use(express.json());

const hasCredentials = () => {
  if (config.google.credentialsPath) {
    return true;
  }
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
};

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/run", async (req, res) => {
  const task = (req.body?.task as SyncTask | undefined) ?? "classroom-sync";

  if (!hasCredentials()) {
    res.status(428).json({
      error: "gcp_credentials_required",
      message:
        "Set GOOGLE_APPLICATION_CREDENTIALS or configure Workload Identity.",
    });
    return;
  }

  try {
    if (task === "classroom-sync") {
      const stats = await syncClassroom();
      res.json({ task, stats });
      return;
    }
    if (task === "forms-sync") {
      const stats = await syncForms();
      res.json({ task, stats });
      return;
    }

    res.status(400).json({ error: "unknown_task", task });
  } catch (error) {
    res.status(500).json({ error: "sync_failed", message: String(error) });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Ingestion service listening on :${port}`);
});
