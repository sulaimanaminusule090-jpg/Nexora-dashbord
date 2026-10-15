
const COINS = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  SOLUSDT: "solana"
};

const GECKO = "https://api.geckoterminal.com/api/v2";

const NETWORKS = [
  "solana",
  "eth",
  "base",
  "bsc",
  "polygon_pos",
  "arbitrum",
  "optimism",
  "avalanche"
];


async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json;version=20230302"
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "No token or market pool was found for this address on the selected network."
      );
    }

    throw new Error(
      "Market data provider is temporarily unavailable (HTTP " +
      response.status +
      "). Please try again."
    );
  }

  return response.json();
}


function calculateRsi(prices, period = 14) {
  if (prices.length <= period) return null;

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

function calculateEma(prices, period) {
  if (prices.length < period) return null;

  const multiplier = 2 / (period + 1);
  let result =
    prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    result = (prices[i] - result) * multiplier + result;
  }

  return result;
}


function makeSignal(prices) {
  const validPrices = Array.isArray(prices)
    ? prices.filter(
        price => Number.isFinite(price) && price > 0
      )
    : [];

  if (validPrices.length < 55) {
    return {
      signal: "Insufficient market data",
      rsi: null,
      ema20: null,
      ema50: null,
      reason:
        "There is not enough valid hourly price history for a technical signal."
    };
  }

  const rsi = calculateRsi(validPrices, 14);
  const ema20 = calculateEma(validPrices, 20);
  const ema50 = calculateEma(validPrices, 50);

  if (
    !Number.isFinite(rsi) ||
    !Number.isFinite(ema20) ||
    !Number.isFinite(ema50)
  ) {
    return {
      signal: "Insufficient market data",
      rsi: null,
      ema20: null,
      ema50: null,
      reason:
        "The technical indicators could not be calculated reliably."
    };
  }

  
  let signal = "Hold";
  let reason =
    "The indicators do not confirm a clear buy or sell setup.";

  const lastPrice = validPrices[validPrices.length - 1];
  const previousPrice = validPrices[validPrices.length - 2];

  
  if (
    ema20 > ema50 &&
    lastPrice > ema20 &&
    lastPrice > previousPrice &&
    rsi >= 50 &&
    rsi <= 70
  ) {
    signal = "Buy setup";
    reason =
      "Bullish trend confirmed: price is above EMA20, EMA20 is above EMA50, and RSI shows positive momentum.";
  } else if (
    ema20 < ema50 &&
    lastPrice < ema20 &&
    lastPrice < previousPrice &&
    rsi >= 30 &&
    rsi < 50
  ) {
    signal = "Sell setup";
    reason =
      "Bearish trend confirmed: price is below EMA20, EMA20 is below EMA50, and RSI shows negative momentum.";
  } else {
    signal = "Hold";
    reason =
      "The trend and momentum indicators do not confirm a clear buy or sell setup.";
  }
  

  return {
    signal,
    rsi: Number(rsi.toFixed(2)),
    ema20: Number(ema20.toPrecision(8)),
    ema50: Number(ema50.toPrecision(8)),
    reason
  };
}


async function analyzeDefaultCoin(symbol) {
  const coinId = COINS[symbol];

  const result = await getJson(
    "https://api.coingecko.com/api/v3/coins/" +
    coinId +
    "/market_chart?vs_currency=usd&days=3"
  );

  if (!Array.isArray(result.prices)) {
    throw new Error("No historical prices for " + symbol);
  }

  const prices = result.prices.map(item => Number(item[1]));

  if (prices.length < 55) {
    throw new Error("Insufficient historical prices for " + symbol);
  }

  const latestPoint =
  result.prices[result.prices.length - 1];

const price = Number(latestPoint[1]);

const targetTimestamp =
  Number(latestPoint[0]) - 24 * 60 * 60 * 1000;

const previousPoint = result.prices.reduce(
  (closest, point) =>
    Math.abs(Number(point[0]) - targetTimestamp) <
    Math.abs(Number(closest[0]) - targetTimestamp)
      ? point
      : closest,
  result.prices[0]
);

const previous = Number(previousPoint[1]);
const indicators = makeSignal(prices);

  return {
    symbol,
    name: symbol,
    price,
    currency: "USD",
    change24h: Number((((price - previous) / previous) * 100).toFixed(2)),
    ...indicators,
    interval: "approximately 1h",
    dataTimestamp: result.prices[result.prices.length - 1][0]
  };
}

async function searchToken(query, network) {
  const addressQuery =
    /^0x[a-fA-F0-9]{40}$/.test(query) ||
    (network === "solana" &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query));

  let url;

  if (addressQuery) {
    url =
      GECKO +
      "/networks/" +
      encodeURIComponent(network) +
      "/tokens/" +
      encodeURIComponent(query) +
      "/pools?include=base_token,quote_token,dex";
  } else {
    url =
      GECKO +
      "/search/pools?query=" +
      encodeURIComponent(query) +
      "&network=" +
      encodeURIComponent(network) +
      "&include=base_token,quote_token,dex";
  }

  

  const result = await getJson(url);
  const pools = Array.isArray(result.data) ? result.data : [];
  const included = Array.isArray(result.included) ? result.included : [];

  if (!pools.length) {
    throw new Error("No matching token market was found on this network.");
  }

  const tokenById = new Map(
    included
      .filter(item => item.type === "token")
      .map(item => [item.id, item.attributes || {}])
  );

  

  const candidates = pools.map(pool => {
    const attrs = pool.attributes || {};
    const relationships = pool.relationships || {};

    const baseId = relationships.base_token?.data?.id;
    const quoteId = relationships.quote_token?.data?.id;

    const base = tokenById.get(baseId) || {};
    const quote = tokenById.get(quoteId) || {};

    const baseAddress = String(base.address || "");
    const quoteAddress = String(quote.address || "");

    const baseText =
      (String(base.name || "") + " " + String(base.symbol || "")).toLowerCase();

    const quoteText =
      (String(quote.name || "") + " " + String(quote.symbol || "")).toLowerCase();

    const q = query.toLowerCase();

    let side = "base";
    let matched = false;

      
if (addressQuery) {
  if (baseAddress.toLowerCase() === q) {
    side = "base";
    matched = true;
  } else if (quoteAddress.toLowerCase() === q) {
    side = "quote";
    matched = true;
  }
} else {
  const baseName = String(base.name || "").trim().toLowerCase();
  const baseSymbol = String(base.symbol || "").trim().toLowerCase();
  const quoteName = String(quote.name || "").trim().toLowerCase();
  const quoteSymbol = String(quote.symbol || "").trim().toLowerCase();

  if (baseSymbol === q || baseName === q) {
    side = "base";
    matched = true;
  } else if (quoteSymbol === q || quoteName === q) {
    side = "quote";
    matched = true;
  }
}
    

    return {
      pool,
      attrs,
      base,
      quote,
      side,
      matched,
      liquidity: Number(attrs.reserve_in_usd || 0)
    };
  });

    const eligible = candidates.filter(item => item.matched);

  if (!eligible.length && addressQuery) {
    throw new Error(
      "That address was not found on the selected network. Check the address and blockchain."
    );
  }

  if (!eligible.length) {
    throw new Error(
      "No exact token name or symbol match was found on this network. Try the token mint/contract address."
    );
  }

 
eligible.sort((a, b) => b.liquidity - a.liquidity);

let chosen = null;
let chosenCandles = [];

for (const candidate of eligible) {
  const candidatePoolAddress = candidate.attrs.address;

  if (!candidatePoolAddress) continue;

  try {
    const candleUrl =
      GECKO +
      "/networks/" +
      encodeURIComponent(network) +
      "/pools/" +
      encodeURIComponent(candidatePoolAddress) +
      "/ohlcv/hour?aggregate=1&limit=100&currency=usd&token=" +
      candidate.side;

    const candleResult = await getJson(candleUrl);
    const candles =
      candleResult.data?.attributes?.ohlcv_list || [];

    const validCandles = candles.filter(candle =>
      Array.isArray(candle) &&
      Number.isFinite(Number(candle[0])) &&
      Number.isFinite(Number(candle[4])) &&
      Number(candle[4]) > 0
    );

    if (validCandles.length > 0) {
      chosen = candidate;
      chosenCandles = validCandles;
      break;
    }
  } catch (error) {
    console.log(
      "Pool candles unavailable:",
      candidatePoolAddress,
      error.message
    );
  }
}

if (!chosen) {
  throw new Error(
    "No matching pool with valid hourly candle history was found."
  );
}

const attrs = chosen.attrs;
const token = chosen.side === "base" ? chosen.base : chosen.quote;
  
  
if (
  addressQuery &&
  String(token.address || "").toLowerCase() !== query.toLowerCase()
) {
  throw new Error(
    "The returned token address does not match your requested address."
  );
}
  
  const tokenPrice = Number(
    chosen.side === "base"
      ? attrs.base_token_price_usd
      : attrs.quote_token_price_usd
  );

  const poolAddress = attrs.address;

  if (!poolAddress || !Number.isFinite(tokenPrice) || tokenPrice <= 0) {
    throw new Error("A valid token price or liquidity pool is not available.");
  }

  
const prices = chosenCandles
  .slice()
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(candle => Number(candle[4]))
  .filter(price => Number.isFinite(price) && price > 0);
  
  

  const indicators = makeSignal(prices);
  const changes = attrs.price_change_percentage || {};
  const volumes = attrs.volume_usd || {};

  return {
    symbol: String(token.symbol || query).toUpperCase(),
    name: token.name || attrs.name || query,
    address: token.address || query,
    network,
    poolAddress,
    price: tokenPrice,
    currency: "USD",
    change24h: Number(changes.h24 || 0),
    liquidity: Number(attrs.reserve_in_usd || 0),
    volume24h: Number(volumes.h24 || 0),
    ...indicators,
    interval: "1h candles when available",
    dataStatus:
      prices.length >= 55
        ? "Technical analysis available"
        : "Price available; historical data is insufficient"
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  const query =
    typeof req.query.query === "string" ? req.query.query.trim() : "";

  if (query) {
    const network =
      typeof req.query.network === "string"
        ? req.query.network.trim().toLowerCase()
        : "solana";

    if (!NETWORKS.includes(network)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported network."
      });
    }

    if (query.length < 2 || query.length > 120) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid token name, symbol, or address."
      });
    }

    try {
      const coin = await searchToken(query, network);

      return res.status(200).json({
        success: true,
        provider: "GeckoTerminal",
        generatedAt: new Date().toISOString(),
        data: [coin],
        warning:
          "Experimental technical signals, not financial advice or guaranteed returns."
      });
    } catch (error) {
      console.error("Token search error:", error.message);

      return res.status(502).json({
        success: false,
        error: error.message || "Token search is temporarily unavailable."
      });
    }
  }

  const requested =
    typeof req.query.symbols === "string"
      ? req.query.symbols.split(",").map(s => s.trim().toUpperCase())
      : Object.keys(COINS);

  const symbols = [...new Set(requested)];

  if (!symbols.length || symbols.some(symbol => !COINS[symbol])) {
    return res.status(400).json({
      success: false,
      error: "Supported default symbols: BTCUSDT, ETHUSDT, SOLUSDT."
    });
  }

  const results = await Promise.allSettled(
    symbols.map(analyzeDefaultCoin)
  );

  const data = results
    .filter(result => result.status === "fulfilled")
    .map(result => result.value);

  if (!data.length) {
    return res.status(502).json({
      success: false,
      error: "Market data is temporarily unavailable."
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
      ? { partial: true, unavailableCount: symbols.length - data.length }
      : {})
  });
};
