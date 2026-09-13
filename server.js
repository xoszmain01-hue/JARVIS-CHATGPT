import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Serve the JARVIS interface
app.use(express.static(path.join(__dirname, "public")));

// Home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "jarvis.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    assistant: "JARVIS",
    version: "1.0"
  });
});

app.listen(PORT, () => {
  console.log(`JARVIS is running on port ${PORT}`);
});