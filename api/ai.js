module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { message, attachment, history } = req.body || {};

    if (
  (typeof message !== "string" || !message.trim()) &&
  !attachment
) {
  return res.status(400).json({
    success: false,
    error: "Please enter a question or select a file."
  });
}

if (attachment) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

  if (
    !allowedTypes.includes(attachment.mimeType) ||
    typeof attachment.data !== "string" ||
    !attachment.data
  ) {
    return res.status(400).json({
      success: false,
      error: "Please upload a supported image or PDF."
    });
  }

  if (attachment.data.length > 4_000_000) {
    return res.status(413).json({
      success: false,
      error: "File is too large. Please use a smaller file."
    });
  }
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
11. Ask a follow-up question only when a missing detail is necessary to answer correctly. Ask one focused question at a time.

12. Read the full conversation and use details the user has already provided. Never repeat a question that has already been answered. If enough information is available, answer directly instead of asking more questions.

13. When the user clarifies or corrects something, acknowledge it briefly and continue using the corrected information. Give a direct, useful answer before adding optional explanations.

14. Format answers for mobile screens using clear headings,
    short paragraphs, bullet lists, and numbered steps.

15. Use Markdown for headings, bold text, lists, inline code,
    and fenced code blocks when showing programming code.

16. Keep code blocks intact and readable. Explain important
    code briefly when useful.

17. Avoid huge paragraphs, excessive headings, and repetition.

18. When a user uploads an image or PDF, answer questions
    about the actual attachment. Never invent its contents.

Your goal is to help users understand Nexora safely
without misleading them about the current capabilities
of the platform.`
  
            }]
          },
          contents: [
  ...(Array.isArray(history)
    ? history.slice(-12)
        .filter(item =>
          item &&
          (item.role === "user" || item.role === "model") &&
          typeof item.text === "string" &&
          item.text.trim()
        )
        .map(item => ({
          role: item.role,
          parts: [{ text: item.text.trim().slice(0, 4000) }]
        }))
    : []),
  {
    role: "user",
    parts: [
      ...(typeof message === "string" && message.trim()
        ? [{ text: message.trim() }]
        : []),
      ...(attachment ? [{
        inline_data: {
          mime_type: attachment.mimeType,
          data: attachment.data
        }
      }] : [])
    ]
  }
],
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
