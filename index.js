import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.UNIVERSE_ID;   // 9157413984
const SHARED_SECRET = process.env.SHARED_SECRET;
const TOPIC = "saweria-donations";

// publish pesan ke Roblox MessagingService (Open Cloud)
async function publishToRoblox(payload) {
  const url =
    `https://apis.roblox.com/messaging-service/v1/universes/` +
    `${UNIVERSE_ID}/topics/${encodeURIComponent(TOPIC)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": ROBLOX_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: JSON.stringify(payload) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Roblox publish failed: ${res.status} ${text}`);
  }
}

// convert username Roblox -> userId
async function usernameToUserId(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.data?.[0]?.id ?? null;
}

app.get("/", (_, res) => res.send("OK"));

app.post("/webhook/saweria", async (req, res) => {
  try {
    // supaya gampang debug, log payload Saweria
    console.log("SAWERIA BODY:", JSON.stringify(req.body));

    const body = req.body;

    // donor isi "Nama" = Roblox username
    const username = String(
      body?.donator_name ||
      body?.supporter_name ||
      body?.name ||
      ""
    ).trim();

    const amount = Number(body?.amount_raw || body?.amount || 0);

    if (!username || username.length < 3) {
      return res.status(200).json({ ok: true, skipped: "no username" });
    }
    if (!amount || amount <= 0) {
      return res.status(200).json({ ok: true, skipped: "no amount" });
    }

    const userId = await usernameToUserId(username);
    if (!userId) {
      return res.status(200).json({ ok: true, skipped: "roblox user not found" });
    }

    // kirim ke Roblox
    await publishToRoblox({
      secret: SHARED_SECRET,
      donationId: body?.id || body?.donation_id || body?.transaction_id || `${Date.now()}`,
      userId,
      amount,          // rupiah
      source: "saweria",
      username,
      ts: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Listening..."));
