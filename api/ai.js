
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please enter a message."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Nexora AI is not configured yet."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are Nexora AI, the helpful AI assistant inside the Nexora ecosystem. Explain things clearly, help users understand Nexora services, and never claim a feature or transaction exists unless verified."
            },
            {
              role: "user",
              content: message.trim()
            }
          ],
          temperature: 0.7
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
  console.error("OpenAI API error:", {
    status: response.status,
    code: data?.error?.code,
    message: data?.error?.message
  });

  if (
  data?.error?.code === "insufficient_quota" ||
  data?.error?.type === "insufficient_quota"
) {
    return res.status(503).json({
      success: false,
      error: "Nexora AI is temporarily unavailable because its AI service has run out of API credits. Please try again later."
    });
  }

  return res.status(502).json({
    success: false,
    error: "Nexora AI could not generate a response right now. Please try again later."
  });
    }

    const answer =
      data.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        success: false,
        error: "No response was generated."
      });
    }

    return res.status(200).json({
      success: true,
      answer
    });
  } catch (error) {
    console.error("Nexora AI error:", error);

    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred."
    });
  }
}
