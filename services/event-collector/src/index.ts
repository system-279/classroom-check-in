import express from "express";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/v1/events/video", (req, res) => {
  res.status(202).json({ accepted: true, received: req.body ?? null });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Event Collector listening on :${port}`);
});
