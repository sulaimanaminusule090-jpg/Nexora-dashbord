
const GECKO = "https://api.geckoterminal.com/api/v2";

const TIMEFRAMES = {
  "15m": { period: "minute", aggregate: 15 },
  "1h": { period: "hour", aggregate: 1 },
  "4h": { period: "hour", aggregate: 4 },
  "1d": { period: "day", aggregate: 1 }
};

module.exports = async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "s-maxage=30, stale-while-revalidate=60"
  );

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  const network = typeof req.query.network === "string"
    ? req.query.network.trim().toLowerCase()
    : "";

  const pool = typeof req.query.pool === "string"
    ? req.query.pool.trim()
    : "";

  const timeframe = typeof req.query.timeframe === "string"
    ? req.query.timeframe.trim().toLowerCase()
    : "1h";

  if (
    !network ||
    network.length > 64 ||
    !/^[a-z0-9_]+$/.test(network)
  ) {
    return res.status(400).json({
      success: false,
      error: "A valid supported network slug is required."
    });
  }

  if (!pool || pool.length > 150 || /[/?#]/.test(pool)) {
    return res.status(400).json({
      success: false,
      error: "A valid pool address is required."
    });
  }

  if (!Object.prototype.hasOwnProperty.call(TIMEFRAMES, timeframe)) {
    return res.status(400).json({
      success: false,
      error: "Use timeframe 15m, 1h, 4h, or 1D."
    });
  }

  try {
    const config = TIMEFRAMES[timeframe];

    const url =
      GECKO +
      "/networks/" + encodeURIComponent(network) +
      "/pools/" + encodeURIComponent(pool) +
      "/ohlcv/" + config.period +
      "?aggregate=" + config.aggregate +
      "&limit=100&currency=usd";

    const response = await fetch(url, {
      headers: {
        Accept: "application/json;version=20230302"
      }
    });

    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        success: false,
        error: response.status === 404
          ? "No candle history found. Check the network and pool address."
          : "Market data provider is temporarily unavailable."
      });
    }

    const result = await response.json();
    const rawCandles = result.data?.attributes?.ohlcv_list || [];

    const candles = rawCandles
      .map(function (candle) {
        return {
          time: Number(candle[0]),
          open: Number(candle[1]),
          high: Number(candle[2]),
          low: Number(candle[3]),
          close: Number(candle[4]),
          volume: Number(candle[5])
        };
      })
      .filter(function (candle) {
        return Number.isFinite(candle.time) &&
          Number.isFinite(candle.open) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          Number.isFinite(candle.close) &&
          candle.open > 0 &&
          candle.high > 0 &&
          candle.low > 0 &&
          candle.close > 0;
      })
      .sort(function (a, b) {
        return a.time - b.time;
      });

    return res.status(200).json({
      success: true,
      provider: "GeckoTerminal",
      network: network,
      pool: pool,
      timeframe: timeframe === "1d" ? "1D" : timeframe,
      candles: candles
    });
  } catch (error) {
    console.error("Nexora chart API error:", error);

    return res.status(502).json({
      success: false,
      error: "Could not load chart data. Please try again."
    });
  }
};
