
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { message, attachment, history } = req.body || {};
    const userMessage =
      typeof message === "string" ? message.trim() : "";

    if (!userMessage && !attachment) {
      return res.status(400).json({
        success: false,
        error: "Please enter a question or select a file."
      });
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf"
    ];

    if (attachment) {
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

      if (attachment.data.length > 4200000) {
        return res.status(413).json({
          success: false,
          error: "File is too large. Please use a smaller file."
        });
      }
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      return res.status(500).json({
        success: false,
        error: "Nexora AI is not configured. Check Cloudflare settings."
      });
    }

    
    
const systemPrompt = `You are Nexora AI, an intelligent, helpful, accurate multilingual assistant.

CORE BEHAVIOR:
- Understand the user's actual goal before answering.
- Answer the main question directly, then explain what matters.
- For complex tasks, break the solution into clear, practical steps.
- Adapt the depth of the answer to the user's needs and experience.
- Ask one focused clarifying question only when essential information is missing.
- Never repeat the same point unnecessarily.
- Do not claim you performed an action, tested code, accessed a website, or verified information unless you actually did.

LANGUAGE:
- Detect the language of the user's latest message and reply in that language unless another language is requested.
- For Hausa, use fluent, natural Northern Nigerian Hausa that sounds like a real conversation.
- Prefer common, clear Hausa words instead of awkward literal translations from English.
- Understand Hausa-English code-switching, spelling variations, and informal Hausa messages.
- Keep sentences clear and grammatically natural.
- Use English technical terms in brackets when they help the user understand.
- If the user asks in Hausa, do not switch to English unnecessarily.

REASONING AND PROBLEM SOLVING:
- Consider the user's goal, relevant context, constraints, and possible errors before answering.
- For difficult questions, check the logic and important assumptions before giving the conclusion.
- Present the key reasons and useful steps, not hidden internal reasoning.
- Compare options fairly and explain important trade-offs.
- Clearly distinguish confirmed facts, estimates, and uncertainty.
- If an approach fails, use the available evidence to diagnose the cause instead of guessing.

CODING:
- First understand the user's actual coding goal and inspect any available code and project context.
- Preserve existing working features and avoid unrelated changes.
- When helping with an existing project, use its actual file names, functions, and code structure whenever available.
- Give precise file names and line numbers only when verified from the current code.
- When asking the user to replace code, clearly identify the beginning and end of the section to replace.
- Provide complete, syntactically correct replacement code and explain what must remain unchanged.
- Prefer the smallest safe change that solves the problem.
- Never invent file contents, line numbers, test results, or deployment status.
- Explain errors using the available evidence and suggest one practical next step at a time.
- Protect API keys, environment variables, user data, and other secrets.
- Never ask for passwords, API keys, or wallet recovery phrases.

IMAGES AND DOCUMENTS:
- Answer questions about supplied images and PDFs using the available evidence.
- Distinguish visible details from assumptions.
- For image-generation requests, preserve the requested subject, clothing, setting, and style.
- Do not claim to have created or analyzed a file unless the operation succeeded.

ACCURACY AND SAFETY:
- Never invent facts, statistics, prices, sources, or document clauses.
- Be honest when information is missing or outdated.
- Do not claim to have searched the web unless a search tool was actually used.
- For financial topics, explain risks and never guarantee profits.
- Respect user privacy and provide practical, responsible guidance.

RESPONSE STYLE:
- Be warm, respectful, clear, and useful.
- Use headings, numbered steps, examples, or code when they improve understanding.
- Be concise by default, but provide detail when requested.
- Finish with a clear next step when the user is working through a task.`;
    
    const recentHistory = Array.isArray(history)
      ? history.slice(-10)
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
            content: item.text.trim().slice(0, 2500)
          }))
      : [];

    const headers = {
      Authorization: `Bearer ${apiToken}`
    };

    async function runTextAI(userContent, includeHistory = true) {
      const response = await fetch(
        
`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
        
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              ...(includeHistory ? recentHistory : []),
              { role: "user", content: userContent }
            ],
            max_tokens: 2048,
            temperature: 0.5
          })
        }
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        console.error("Cloudflare text error:", {
          status: response.status,
          errors: data.errors
        });

        const error = new Error("Cloudflare text request failed.");
        error.status = response.status;
        throw error;
      }

      return data.result?.response?.trim() || "";
    }

    let answer = "";

    if (attachment?.mimeType === "application/pdf") {
      // Convert the PDF into Markdown.
      const base64 = attachment.data.replace(
        /^data:application\/pdf;base64,/i,
        ""
      );

      const pdfBytes = Buffer.from(base64, "base64");
      const form = new FormData();

      form.append(
        "files",
        new Blob([pdfBytes], { type: "application/pdf" }),
        "nexora-document.pdf"
      );

      const pdfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/tomarkdown`,
        {
          method: "POST",
          headers,
          body: form
        }
      );

      const pdfData = await pdfResponse.json();

      if (!pdfResponse.ok || pdfData.success === false) {
        console.error("Cloudflare PDF error:", {
          status: pdfResponse.status,
          errors: pdfData.errors
        });

        return res.status(
          pdfResponse.status === 429 ? 429 : 502
        ).json({
          success: false,
          error: pdfResponse.status === 429
            ? "Cloudflare AI usage limit reached. Please try again later."
            : "Nexora could not read this PDF. Please try another file."
        });
      }

      const converted = pdfData.result?.[0];
      const documentText = String(
  converted?.data ?? ""
).trim();

      if (!documentText || converted?.format === "error") {
        return res.status(502).json({
          success: false,
          error: "No readable text could be extracted from this PDF."
        });
      }

      const question = userMessage ||
        "Please summarize this PDF and explain its main points.";

      
      answer = await runTextAI(
        `${question}

You are answering a question about the attached PDF.
Use only the document text below as evidence.
Look for the exact relevant clause, amount, fee, percentage, date, or condition before answering.
If the requested detail is not present or cannot be verified, say so clearly.
Do not guess or substitute general knowledge.
Keep the answer concise and avoid repetition.

--- BEGIN PDF TEXT ---
${documentText.slice(0, 45000)}
--- END PDF TEXT ---`,
        false
      );
      

    } else if (attachment) {
      // Analyze the image with Cloudflare Vision.
      const base64 = attachment.data.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/i,
        ""
      );

      const imageBytes = Array.from(
        Buffer.from(base64, "base64")
      );

      const question = userMessage ||
        "Describe this image and explain its important details.";

      const visionResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
        {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: `${systemPrompt}

User's question: ${question}

Analyze the attached image carefully. Reply in the user's language.
Do not invent details that cannot be seen.`,
            image: imageBytes,
            max_tokens: 2048,
            temperature: 0.5
          })
        }
      );

      const visionData = await visionResponse.json();

      if (!visionResponse.ok || visionData.success === false) {
        console.error(
  "Cloudflare Vision error:",
  visionResponse.status,
  JSON.stringify(visionData.errors)
);

        return res.status(
          visionResponse.status === 429 ? 429 : 502
        ).json({
          success: false,
          error: visionResponse.status === 429
            ? "Cloudflare AI usage limit reached. Please try again later."
            : "Nexora could not analyze this image. Please try again."
        });
      }

      answer = visionData.result?.response?.trim() || "";

    } else {
      // Normal text conversation.
      answer = await runTextAI(userMessage);
    }

    if (!answer) {
      return res.status(502).json({
        success: false,
        error: "Nexora AI did not generate a response. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      answer
    });

  } catch (error) {
    console.error("Nexora AI error:", {
      status: error.status,
      message: error.message
    });

    return res.status(
      error.status === 429 ? 429 : 502
    ).json({
      success: false,
      error: error.status === 429
        ? "Cloudflare AI usage limit reached. Please try again later."
        : "Nexora AI could not complete your request. Please try again."
    });
  }
};
