
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function calculateRsi(closes, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
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
  let ema =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }

  return ema;
}

async function analyzeCoin(symbol) {
  const url =
    "https://api.binance.com/api/v3/klines?symbol=" +
    symbol + "&interval=1h&limit=100";

  const response = await fetch(url);

  
  if (!response.ok) {
    const errorBody = await response.text();

    throw new Error(
      "Binance HTTP " + response.status +
      " for " + symbol + ": " +
      errorBody.slice(0, 200)
    );
  }
  

  const candles = await response.json();

  if (!Array.isArray(candles) || candles.length < 55) {
    throw new Error("Insufficient candle data for " + symbol);
  }

  const closes = candles.map(c => Number(c[4]));
  const volumes = candles.map(c => Number(c[5]));
  const price = closes[closes.length - 1];
  const rsi = calculateRsi(closes);
  const ema20 = calculateEma(closes, 20);
  const ema50 = calculateEma(closes, 50);

  let signal = "Neutral";
  let reason = "Indicators do not agree on a clear direction.";

  if (ema20 > ema50 && rsi >= 50 && rsi <= 68) {
    signal = "Buy setup";
    reason = "EMA20 is above EMA50 and RSI shows positive momentum.";
  } else if (ema20 < ema50 && rsi >= 32 && rsi < 50) {
    signal = "Sell setup";
    reason = "EMA20 is below EMA50 and RSI shows negative momentum.";
  }

  const previous24h = closes[closes.length - 25];
  const change24h = ((price - previous24h) / previous24h) * 100;
  const avgVolume =
    volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;

  return {
    symbol,
    price,
    change24h: Number(change24h.toFixed(2)),
    rsi: Number(rsi.toFixed(2)),
    ema20,
    ema50,
    volumeRatio: avgVolume
      ? Number((volumes[volumes.length - 1] / avgVolume).toFixed(2))
      : null,
    signal,
    reason,
    interval: "1h",
    candleCloseTime: candles[candles.length - 1][6]
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  const requested = typeof req.query.symbols === "string"
    ? req.query.symbols.split(",").map(s => s.trim().toUpperCase())
    : SYMBOLS;

  const symbols = [...new Set(requested)];

  if (!symbols.length || symbols.some(s => !SYMBOLS.includes(s))) {
    return res.status(400).json({
      success: false,
      error: "Supported symbols: BTCUSDT, ETHUSDT, SOLUSDT."
    });
  }

  try {
    const results = await Promise.allSettled(
      symbols.map(analyzeCoin)
    );

    const data = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    
    if (!data.length) {
      const failures = results
        .filter(r => r.status === "rejected")
        .map(r => String(r.reason?.message || "Unknown market data error"));

      console.error("All crypto signal requests failed:", failures);

      return res.status(502).json({
        success: false,
        error: "Market data is temporarily unavailable.",
        diagnostic: failures
      });
    }
    

    return res.status(200).json({
      success: true,
      provider: "Binance public market data",
      generatedAt: new Date().toISOString(),
      interval: "1h",
      data,
      warning:
        "Experimental technical signals, not financial advice or guaranteed returns.",
      ...(data.length < symbols.length
        ? { partial: true, unavailableCount: symbols.length - data.length }
        : {})
    });
  } catch (error) {
    console.error("Crypto signals error:", error);
    return res.status(502).json({
      success: false,
      error: "Unable to retrieve market data."
    });
  }
};
