import express from "express";

const app = express();
app.use(express.json());

const notImplemented = (_req: express.Request, res: express.Response) => {
  res.status(501).json({ error: "not_implemented" });
};

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/run", notImplemented);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Session service listening on :${port}`);
});
