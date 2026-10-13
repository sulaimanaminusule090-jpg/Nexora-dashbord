
const COINS = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana"
};

function calculateRsi(prices, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];

    avgGain =
      (avgGain * (period - 1) + Math.max(change, 0)) / period;

    avgLoss =
      (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;

  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateEma(values, period) {
  const multiplier = 2 / (period + 1);

  let result =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    result = (values[i] - result) * multiplier + result;
  }

  return result;
}

async function analyzeCoin(symbol) {
  const coinId = COINS[symbol];

  const url =
    "https://api.coingecko.com/api/v3/coins/" +
    coinId +
    "/market_chart?vs_currency=usd&days=3";

  const response = await fetch(url);

  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      "CoinGecko HTTP " +
      response.status +
      " for " +
      symbol +
      ": " +
      errorBody.slice(0, 200)
    );
  }

  const result = await response.json();

  if (!Array.isArray(result.prices) || result.prices.length < 55) {
    throw new Error("Insufficient historical prices for " + symbol);
  }

  const prices = result.prices.map(item => Number(item[1]));

  if (prices.some(price => !Number.isFinite(price) || price <= 0)) {
    throw new Error("Invalid price data for " + symbol);
  }

  const latest = result.prices[result.prices.length - 1];
  const price = Number(latest[1]);

  const rsi = calculateRsi(prices);
  const ema20 = calculateEma(prices, 20);
  const ema50 = calculateEma(prices, 50);

  const previous24h = prices[prices.length - 25];

  const change24h =
    ((price - previous24h) / previous24h) * 100;

  let signal = "Neutral";
  let reason = "Indicators do not agree on a clear direction.";

  if (ema20 > ema50 && rsi >= 50 && rsi <= 68) {
    signal = "Buy setup";
    reason =
      "EMA20 is above EMA50 and RSI shows positive momentum.";
  } else if (ema20 < ema50 && rsi >= 32 && rsi < 50) {
    signal = "Sell setup";
    reason =
      "EMA20 is below EMA50 and RSI shows negative momentum.";
  }

  return {
    symbol,
    price,
    currency: "USD",
    change24h: Number(change24h.toFixed(2)),
    rsi: Number(rsi.toFixed(2)),
    ema20: Number(ema20.toFixed(8)),
    ema50: Number(ema50.toFixed(8)),
    signal,
    reason,
    interval: "approximately 1h",
    dataTimestamp: latest[0]
  };
}

module.exports = async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=120"
  );

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  const requested =
    typeof req.query.symbols === "string"
      ? req.query.symbols.split(",").map(s => s.trim().toUpperCase())
      : Object.keys(COINS);

  const symbols = [...new Set(requested)];

  if (
    !symbols.length ||
    symbols.some(symbol => !COINS[symbol])
  ) {
    return res.status(400).json({
      success: false,
      error: "Supported symbols: BTCUSDT, ETHUSDT, SOLUSDT."
    });
  }

  const results = await Promise.allSettled(
    symbols.map(analyzeCoin)
  );

  const data = results
    .filter(result => result.status === "fulfilled")
    .map(result => result.value);

  if (!data.length) {
    const diagnostic = results
      .filter(result => result.status === "rejected")
      .map(result => String(result.reason?.message || "Unknown error"));

    console.error("CoinGecko signal errors:", diagnostic);

    return res.status(502).json({
      success: false,
      error: "Market data is temporarily unavailable.",
      diagnostic
    });
  }

  return res.status(200).json({
    success: true,
    provider: "CoinGecko",
    generatedAt: new Date().toISOString(),
    interval: "approximately 1h",
    data,
    warning:
      "Experimental technical signals, not financial advice or guaranteed returns.",
    ...(data.length < symbols.length
      ? {
          partial: true,
          unavailableCount: symbols.length - data.length
        }
      : {})
  });
};

