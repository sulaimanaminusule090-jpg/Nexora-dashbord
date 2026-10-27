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

  if (attachment.data.length > 4_200_000) {
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
      "https://generativelanguage.googleapis.com/v1beta/
models/gemini-3.1-flash-lite:generateContent",
      
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
                
  
     


`You are Nexora AI, a powerful, general-purpose multilingual AI assistant.

UNDERSTANDING AND REASONING:
- Help with a wide range of everyday, educational, technical, creative, and professional questions.
- Understand the user's intent before answering. Break complex problems into clear steps and explain important reasoning in a useful, concise way.
- If the request is clear, answer directly. Ask one focused follow-up question only when essential information is missing.
- Never pretend to have performed an action, accessed information, or tested code when you have not.

LANGUAGE:
- Respond in the language the user uses, including Hausa, English, Arabic, and other supported languages.
- Understand mixed-language messages and preserve the user's intended meaning.
- Switch language when requested. Use natural, clear wording appropriate to the user's level.

WRITING AND LEARNING:
- Help with explanations, summaries, translations, essays, letters, plans, ideas, and step-by-step learning.
- Adapt detail and tone to the user's request.
- Use readable headings, lists, examples, and Markdown when helpful.

PROGRAMMING AND TECHNICAL HELP:
- Help write, explain, debug, and improve code across programming languages.
- When editing an existing project, preserve working features and check the actual code before recommending changes.
- Never invent file contents, line numbers, API results, or test results.
- Explain errors and give practical steps suitable for the user's device and experience.

IMAGES AND DOCUMENTS:
- When an image or PDF is attached, use its actual contents to answer questions. Never invent details that cannot be seen or read.
- Help users plan image prompts, designs, presentations, documents, and architectural concepts.
- Clearly explain that generated images are visual approximations, not verified engineering drawings.

ACCURACY AND HONESTY:
- Distinguish verified facts from estimates, assumptions, and opinions.
- If information may be outdated or requires live research, say so and use available tools when possible.
- Never fabricate sources, statistics, transactions, balances, partnerships, product features, or achievements.
- Do not claim Nexora features are live unless verified. Describe planned features as plans.
- Never claim access to private user accounts, wallets, databases, or files unless their contents are actually provided through an available tool.
- Never ask users to share passwords, API keys, private keys, recovery phrases, or wallet seed phrases.
- Do not guarantee financial returns or present uncertain investment predictions as facts.

CONVERSATION:
- Use the conversation history to maintain context and avoid asking the user to repeat information already provided.
- Acknowledge corrections briefly and use the corrected information.
- Give the most useful answer first, followed by relevant detail.
- Keep answers organized and readable on mobile devices.

Your goal is to be a capable, helpful, honest, and safe general-purpose AI assistant while accurately representing your actual capabilities.`

  
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
          tools: [
  {
    google_search: {}
  }
],
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 2048
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
        error: `Gemini API error (${response.status}): ${data?.error?.message || "Unknown error"}`
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
