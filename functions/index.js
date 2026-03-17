const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = "You are an enthusiastic, supportive business coach for Open Doors Academy (ODA), an afterschool program for kids ages 8-14. You help students create business pitches step by step. Be creative, specific, and give DIFFERENT suggestions each time you are asked - never repeat the same ideas. Use fun, simple language a kid would understand. Never use markdown formatting (no #, *, **, _ or other formatting). Just plain text. Number your ideas when listing them. Always be encouraging and make entrepreneurship feel exciting and achievable for young people.";

// --- Rate Limiting ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// --- Cloud Function ---
exports.ai = onRequest({ secrets: [ANTHROPIC_KEY] }, async (req, res) => {
  // SECURITY: Restrict CORS to known origins (OWASP A05 / MITRE T1190)
  const allowedOrigins = ["https://odahub.org", "https://www.odahub.org", "http://localhost:3456", "http://127.0.0.1:3456"];
  const origin = req.headers.origin || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.set("Access-Control-Allow-Origin", corsOrigin);
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Vary", "Origin");

  // SECURITY: Additional response headers
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("X-XSS-Protection", "1; mode=block");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // SECURITY: Only allow POST (OWASP A01)
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Rate limiting
  const clientIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  // Firebase Auth verification (optional — students don't have Firebase Auth)
  // If a token is provided, verify it. If not, allow through with stricter rate limit.
  const authHeader = req.headers.authorization;
  let isAuthenticated = false;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    try {
      await admin.auth().verifyIdToken(token);
      isAuthenticated = true;
    } catch (authError) {
      // Invalid token — reject
      res.status(401).json({ error: "Invalid authentication token." });
      return;
    }
  }

  // Unauthenticated requests get a stricter rate limit (10/min vs 30/min)
  if (!isAuthenticated) {
    const unauthEntry = rateLimitMap.get(clientIp + ":unauth");
    const now = Date.now();
    if (!unauthEntry || now - unauthEntry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(clientIp + ":unauth", { windowStart: now, count: 1 });
    } else {
      unauthEntry.count++;
      if (unauthEntry.count > 10) {
        res.status(429).json({ error: "Too many requests. Please try again later." });
        return;
      }
    }
  }

  // Input validation
  const { prompt, max_tokens, temperature, system, model } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "A valid prompt is required." });
    return;
  }

  if (prompt.length > 10000) {
    res.status(400).json({ error: "Prompt exceeds maximum length of 10000 characters." });
    return;
  }

  const validatedMaxTokens = Math.min(Math.max(parseInt(max_tokens, 10) || 1000, 1), 4000);
  const validatedTemperature = Math.min(Math.max(parseFloat(temperature) || 0.9, 0), 1);

  // Model selection — Opus requires authenticated teacher, everyone else gets Sonnet
  const ALLOWED_MODELS = {
    "sonnet": "claude-sonnet-4-20250514",
    "opus": "claude-opus-4-20250514",
  };
  let selectedModel = ALLOWED_MODELS["sonnet"]; // default
  if (model && ALLOWED_MODELS[model]) {
    if (model === "opus" && !isAuthenticated) {
      res.status(403).json({ error: "Opus model requires teacher authentication." });
      return;
    }
    selectedModel = ALLOWED_MODELS[model];
  }

  // Build system prompt — use default, append client system prompt if provided
  let finalSystemPrompt = SYSTEM_PROMPT;
  if (system && typeof system === "string" && system.trim().length > 0) {
    finalSystemPrompt = SYSTEM_PROMPT + "\n\n" + system.trim();
  }

  // Call Anthropic API
  const body = JSON.stringify({
    model: selectedModel,
    max_tokens: validatedMaxTokens,
    temperature: validatedTemperature,
    system: finalSystemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY.value(),
      "anthropic-version": "2023-06-01",
    },
  };

  try {
    const apiResponse = await new Promise((resolve, reject) => {
      const apiReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => { data += chunk; });
        apiRes.on("end", () => {
          try {
            resolve({ status: apiRes.statusCode, body: JSON.parse(data) });
          } catch (parseErr) {
            reject(new Error("Failed to parse API response"));
          }
        });
      });
      apiReq.on("error", (e) => { reject(e); });
      apiReq.write(body);
      apiReq.end();
    });

    if (apiResponse.status === 200) {
      res.status(200).json(apiResponse.body);
    } else {
      console.error("Anthropic API error:", JSON.stringify(apiResponse.body));
      res.status(502).json({ error: "AI service temporarily unavailable." });
    }
  } catch (err) {
    console.error("Request to Anthropic failed:", err.message);
    res.status(500).json({ error: "An internal error occurred." });
  }
});
