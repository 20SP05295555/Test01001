import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { whatsappService } from "./server/whatsapp-service";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get WhatsApp Connection Status
  app.get("/api/whatsapp/status", (req, res) => {
    res.json({
      status: whatsappService.status,
      qrCodeDataUrl: whatsappService.qrCodeDataUrl,
      error: whatsappService.lastError,
      myNumber: whatsappService.myNumber,
    });
  });

  // Initialize/Connect WhatsApp Client
  app.post("/api/whatsapp/initialize", async (req, res) => {
    try {
      // Trigger initialization in background (non-blocking)
      whatsappService.initialize();
      res.json({ success: true, status: "INITIALIZING" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Disconnect/Logout WhatsApp Client
  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      await whatsappService.disconnect();
      res.json({ success: true, status: "DISCONNECTED" });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Verify Phone Number presence on WhatsApp Web Protocol
  app.post("/api/whatsapp/verify", async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
       res.status(400).json({ error: "Missing required 'phone' parameter in request body." });
       return;
    }

    try {
      const result = await whatsappService.verifyNumber(phone);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Query failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
