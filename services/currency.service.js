const axios = require("axios");
const CurrencyConfig = require("../models/currencyConfig.model");

const BASE_URL = process.env.EXCHANGE_RATE_BASE_URL || "https://api.exchangerate.host";
const API_KEY = process.env.EXCHANGE_RATE_API_KEY || "";

// -------------------- Caching (prevents DB lookup per call) --------------------
let cachedConfig = null;
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getCachedCurrencyConfig() {
  if (!cachedConfig || Date.now() - lastFetch > CACHE_TTL) {
    cachedConfig = await CurrencyConfig.findOne().lean();
    lastFetch = Date.now();
  }
  return cachedConfig;
}

/**
 * Parse rate from various API response shapes
 */
function parseRateFromResponse(data) {
  if (!data) return null;
  const info = data.info || {};
  return info.rate ?? info.quote ?? data.result ?? null;
}

/**
 * Fetch live exchange rate INR -> USD and cache in DB.
 * On failure, use last saved rate from DB (fallback).
 */
async function fetchLiveRate(base = "INR", target = "USD") {
  try {
    const res = await axios.get(`${BASE_URL}/convert`, {
      params: {
        access_key: API_KEY || undefined,
        from: base,
        to: target,
        amount: 1,
      },
      timeout: 8000,
    });

    const rate = parseRateFromResponse(res.data);
    if (!rate || Number(rate) <= 0) throw new Error("Invalid rate from provider");

    const cfg = await CurrencyConfig.findOneAndUpdate(
      {},
      {
        baseCurrency: base,
        targetCurrency: target,
        lastRate: Number(rate),
        lastFetchedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    return cfg.lastRate;
  } catch (err) {
    console.warn("fetchLiveRate failed:", err.message);
    const cfg = await CurrencyConfig.findOne({});
    if (cfg && cfg.lastRate > 0) return cfg.lastRate;
    return 0.012; // fallback
  }
}

/**
 * Get current conversion context (rate + admin percentage) from cache.
 */
async function getCurrentConversionContext() {
  let cfg = await getCachedCurrencyConfig();
  if (!cfg || !cfg.lastRate) {
    const rate = await fetchLiveRate();
    cfg = await getCachedCurrencyConfig(); // refresh cache
  }
  return {
    rate: cfg?.lastRate || 0,
    percentage: cfg?.conversionPercentage || 0,
  };
}

/**
 * Convert INR -> USD and return both amount and context.
 * Used for **transactional** conversions (e.g., bookings).
 */
async function convertINRtoUSD(inrAmount) {
  const { rate, percentage } = await getCurrentConversionContext();
  const usd = Number(inrAmount) * Number(rate);
  const finalUsd = usd * (1 + percentage / 100);
  return {
    inr: Number(inrAmount),
    usd: Number(finalUsd.toFixed(4)),      // final USD after percentage
    rate: Number(rate),                    // raw rate
    percentage: Number(percentage),        // admin margin
  };
}

/**
 * Convert INR -> USD using **current** context, but return only the final amount.
 * Suitable for **on‑the‑fly display** in API responses.
 */
async function convertINRtoUSDForDisplay(inrAmount) {
  const { usd } = await convertINRtoUSD(inrAmount);
  return usd;
}

module.exports = {
  fetchLiveRate,
  getCurrentConversionContext,
  convertINRtoUSD,
  convertINRtoUSDForDisplay,
};