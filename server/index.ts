import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { statusMonitor } from "./statusMonitor";

// Check for required environment variables in production
if (process.env.NODE_ENV === "production") {
  const requiredEnvVars = ["SESSION_SECRET"];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    console.error("Please set these environment variables before starting the server.");
    process.exit(1);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize persistent settings on startup
async function initializePersistentSettings() {
  try {
    const persistentSettings = await storage.getApiSettings();
    
    // Load saved settings into environment variables
    if (persistentSettings.TWILIO_ACCOUNT_SID) process.env.TWILIO_ACCOUNT_SID = persistentSettings.TWILIO_ACCOUNT_SID;
    if (persistentSettings.TWILIO_AUTH_TOKEN) process.env.TWILIO_AUTH_TOKEN = persistentSettings.TWILIO_AUTH_TOKEN;
    if (persistentSettings.TWILIO_PHONE_NUMBER) process.env.TWILIO_PHONE_NUMBER = persistentSettings.TWILIO_PHONE_NUMBER;
    if (persistentSettings.AWS_ACCESS_KEY_ID) process.env.AWS_ACCESS_KEY_ID = persistentSettings.AWS_ACCESS_KEY_ID;
    if (persistentSettings.AWS_SECRET_ACCESS_KEY) process.env.AWS_SECRET_ACCESS_KEY = persistentSettings.AWS_SECRET_ACCESS_KEY;
    if (persistentSettings.AWS_REGION) process.env.AWS_REGION = persistentSettings.AWS_REGION;
    
    // Also check for saved Notion configurations for the admin user
    const adminConfig = await storage.getConfiguration("basiliskan@gmail.com");
    if (adminConfig) {
      log(`Notion configuration found for admin: ${adminConfig.workspaceName} (Page: ${adminConfig.notionPageUrl})`);
    } else {
      log("No Notion configuration found for admin user");
    }
    
    log("Persistent settings loaded successfully");
  } catch (error) {
    log("No persistent settings found, starting with defaults");
  }
}

(async () => {
  // Initialize persistent settings first
  await initializePersistentSettings();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use environment PORT variable for production deployment, fallback to 5000 for development
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start status monitoring for automatic email notifications
    setTimeout(() => {
      statusMonitor.startMonitoring(60000); // Check every 60 seconds
    }, 5000); // Wait 5 seconds after server start
  });
})();
