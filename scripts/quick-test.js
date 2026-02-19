// quick-test.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") }); // load parent .env

const mongoose = require("mongoose");
const {
  fetchLiveRate,
  convertINRtoUSD,
} = require("../services/currency.service");

// connect to DB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

(async () => {
  try {
    const rate = await fetchLiveRate();
    console.log("rate:", rate);
    console.log("100 INR =>", await convertINRtoUSD(100));
  } catch (err) {
    console.error("❌ Currency fetch failed:", err.message);
  } finally {
    mongoose.connection.close();
  }
})();
