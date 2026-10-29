
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AUTH_TOKEN, NEXORA_SETUP_KEY } =
    process.env;

  if (!CLOUDFLARE_ACCOUNT_ID ||
      !CLOUDFLARE_AUTH_TOKEN ||
      !NEXORA_SETUP_KEY) {
    return res.status(500).json({
      success: false,
      error: "Missing server environment variables"
    });
  }

  if (!req.query || req.query.key !== NEXORA_SETUP_KEY) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  try {
    const url =
      `https://api.cloudflare.com/client/v4/accounts/` +
      `${CLOUDFLARE_ACCOUNT_ID}/ai/run/` +
      `@cf/meta/llama-3.2-11b-vision-instruct`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_AUTH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: "agree" })
    });

    const data = await response.json();

    return res.status(response.status).json({
      success: response.ok && data.success !== false,
      result: response.ok ? data : undefined,
      errors: response.ok ? undefined : data.errors
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Cloudflare request failed"
    });
  }
};
