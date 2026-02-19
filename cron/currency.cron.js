const cron = require("node-cron");
const { fetchLiveRate } = require("../services/currency.service");

// Daily at 2 AM – only update the exchange rate, DO NOT recalc prices
cron.schedule("0 2 * * *", async () => {
  try {
    await fetchLiveRate("INR", "USD");
  } catch (err) {
    console.error("❌ Currency cron error (caught):", err?.message ?? err);
  }
});
