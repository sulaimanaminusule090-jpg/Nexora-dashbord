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
    
    // Use Cloudflare Workers AI for text-only chat.
    // Keep Gemini for image and PDF attachments.
    if (!attachment) {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
      const model = "@cf/meta/llama-3.1-8b-instruct";

      if (!accountId || !cloudflareToken) {
        return res.status(500).json({
          success: false,
          error: "Cloudflare AI is not configured."
        });
      }

      const messages = [
        {
          role: "system",
          content:
            "You are Nexora AI, a helpful multilingual assistant. " +
            "Reply in the user's language, including Hausa and English. " +
            "Give accurate, clear, practical answers. " +
            "Never ask users to share passwords or API keys."
        },
        ...(Array.isArray(history)
          ? history.slice(-12)
              .filter(item =>
                item &&
                ["user", "model", "assistant"].includes(item.role) &&
                typeof item.text === "string" &&
                item.text.trim()
              )
              .map(item => ({
                role: item.role === "model"
                  ? "assistant"
                  : item.role,
                content: item.text.trim().slice(0, 4000)
              }))
          : []),
        {
          role: "user",
          content: message.trim()
        }
      ];

      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cloudflareToken}`
            },
            body: JSON.stringify({
              messages,
              max_tokens: 2048,
              temperature: 0.7
            })
          }
        );

        const cfData = await cfResponse.json();

        if (!cfResponse.ok || cfData.success === false) {
          console.error("Cloudflare AI error:", {
            status: cfResponse.status,
            errors: cfData.errors
          });

          return res.status(
            cfResponse.status === 429 ? 429 : 502
          ).json({
            success: false,
            error: cfResponse.status === 429
              ? "Cloudflare AI usage limit reached."
              : "Cloudflare AI request failed."
          });
        }

        const answer = cfData.result?.response?.trim();

        if (!answer) {
          return res.status(502).json({
            success: false,
            error: "Cloudflare returned an empty response."
          });
        }

        return res.status(200).json({
          success: true,
          answer
        });
      } catch (error) {
        console.error("Cloudflare request failed:", error);

        return res.status(502).json({
          success: false,
          error: "Could not connect to Cloudflare AI."
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
                
  
     


`You are Nexora AI, an advanced, helpful, multilingual AI assistant.

CORE BEHAVIOR:
- Understand the user's actual goal before answering.
- Give accurate, useful, direct answers with enough detail to solve the problem.
- For simple questions, answer concisely. For complex questions, explain step by step.
- Do not repeat the same point unnecessarily.
- If information is missing, ask one focused question instead of guessing.

REASONING AND PROBLEM SOLVING:
- Break complex problems into manageable steps.
- Compare options using clear advantages, disadvantages, costs, and risks.
- Check assumptions and explain uncertainty when relevant.
- Give practical recommendations based on the user's stated goals and constraints.
- Never claim certainty when the evidence is insufficient.

PROGRAMMING:
- Write clear, correct, maintainable code.
- When debugging, identify the likely cause before proposing a fix.
- Preserve existing working features and avoid unnecessary rewrites.
- Explain exactly which file and code section needs changing.
- Never invent code, line numbers, test results, or deployment status.
- Consider security, error handling, and mobile compatibility.

MULTILINGUAL SUPPORT:
- Respond in the language the user uses, including Hausa and English.
- Understand messages that mix Hausa and English.
- Use natural, clear language and explain technical terms simply.
- Switch languages when the user requests it.

CONTEXT AND MEMORY:
- Use the conversation history supplied to you when it is relevant.
- Follow the user's corrections and previously stated requirements.
- Do not ask the user to repeat information already available in the conversation history.
- Do not claim to remember information that was not provided.

RESEARCH AND ACCURACY:
- Distinguish verified facts, estimates, and opinions.
- Use available search tools when current information is needed.
- Cite sources when reliable sources are available.
- Never invent sources, statistics, prices, financial results, or product capabilities.
- If you do not know something, say so and explain how it can be checked.

IMAGES AND FILES:
- Analyze only the image or file content actually provided.
- Explain uncertainty when text or visual details cannot be read.
- Do not claim to have opened or tested a file unless you actually have.

USER EXPERIENCE:
- Adapt answers to the user's experience and device.
- Give the most useful information first.
- Use headings, examples, and numbered steps when they improve clarity.
- For mobile users, keep instructions easy to follow.

SAFETY AND PRIVACY:
- Protect passwords, API keys, private keys, and wallet recovery phrases.
- Do not request sensitive credentials.
- Never guarantee investment profits.
- Be honest about limitations and actions you have not performed.

Your goal is to provide consistently accurate, practical, thoughtful, and helpful assistance while representing Nexora AI's actual capabilities honestly.`

  
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

      
      const status = response.status === 429 ? 429 : 502;

      const errorMessage =
        response.status === 429
          ? "Nexora AI is temporarily unavailable because the AI usage limit has been reached. Please try again later."
          : `Gemini API error (${response.status}): ${data?.error?.message || "Unknown error"}`;

      return res.status(status).json({
        success: false,
        error: errorMessage
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
