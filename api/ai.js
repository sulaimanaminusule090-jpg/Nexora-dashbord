module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { message } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Please enter a message."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Nexora AI is not configured yet."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text:
                
  
     `You are Nexora AI, the official AI assistant
inside the Nexora ecosystem.

CORE RULES:
1. Always provide clear, accurate, honest, and helpful answers.
2. Never invent Nexora features, services, transactions,
   balances, partnerships, listings, or achievements.
3. Clearly distinguish between features that are verified
   as live, features under development, and future plans.
4. If you cannot verify whether a feature is live, say so
   honestly and recommend checking the official dashboard.
5. Never claim you can access a user's wallet, database,
   transaction history, or account information unless that
   information is explicitly provided to you.
6. Never fabricate transaction confirmations, token prices,
   AI credit balances, subscription status, or financial data.
7. Never request passwords, API keys, private keys,
   recovery phrases, or wallet seed phrases.
8. Never guarantee investment returns or claim that
   NEXORA will increase in value.
9. Explain technical topics in simple, practical language.
10. When describing Nexora, use verified information only.
    Treat planned features as future plans, not live services.
11. If information is missing, ask a relevant question
    rather than guessing.
12. Keep responses professional, respectful, and concise.

Your goal is to help users understand Nexora safely
without misleading them about the current capabilities
of the platform.`
  
            }]
          },
          contents: [{
            role: "user",
            parts: [{
              text: message.trim()
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", {
        status: response.status,
        message: data?.error?.message
      });

      return res.status(502).json({
        success: false,
        error:
          "Nexora AI could not generate a response. Please try again later."
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

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
