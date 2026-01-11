import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ✅ Render Environment Variables
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const ROBLOX_UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN;

// ✅ Roblox topic (bebas, nanti Roblox Subscribe pakai nama yang sama)
const TOPIC = "saweria-donations";

// Helper: format Rupiah
function formatRupiah(n) {
  const num = Number(n) || 0;
  return "Rp" + num.toLocaleString("id-ID");
}

// Publish pesan ke Roblox MessagingService (Open Cloud)
async function publishToRoblox(payload) {
  const url =
    `https://apis.roblox.com/messaging-service/v1/universes/` +
    `${encodeURIComponent(ROBLOX_UNIVERSE_ID)}/topics/${encodeURIComponent(TOPIC)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": ROBLOX_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Open Cloud MessagingService butuh field "message" string
      message: JSON.stringify(payload),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Roblox publish failed: ${res.status} ${text}`);
  }
}

// ✅ Health check (biar gampang ngetes)
app.get("/", (req, res) => {
  res.status(200).send("OK - Saweria Roblox bridge is running");
});

// ✅ Endpoint webhook Saweria
app.post("/saweria", async (req, res) => {
  try {
    // 1) cek token dari query
    const token = req.query.token;
    if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
      return res.status(401).send("Unauthorized (bad token)");
    }

    // 2) ambil data dari payload (Saweria kadang beda bentuk, jadi kita amanin)
    const body = req.body || {};
    const data = body.data || body; // jaga-jaga

    const rawName =
      data.donator_name ||
      data.donor_name ||
      data.name ||
      data.username ||
      "Someone";

    const amount =
      data.amount_raw ||
      data.amount ||
      data.amount_total ||
      data.nominal ||
      0;

    const messageText = data.message || data.note || "";

    // 3) payload yang kita kirim ke Roblox
    const payload = {
      platform: "saweria",
      name: String(rawName),
      amount: Number(amount) || 0,
      amountText: formatRupiah(amount),
      message: String(messageText || ""),
      ts: Date.now(),
    };

    console.log("[SAWERIA] incoming:", payload);

    // 4) publish ke Roblox
    await publishToRoblox(payload);

    console.log("[ROBLOX] published to topic:", TOPIC);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).send("Server error");
  }
});

// ✅ Render port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on", PORT));
