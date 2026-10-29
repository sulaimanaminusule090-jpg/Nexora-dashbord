
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

    
    const systemPrompt = `You are Nexora AI, a helpful, accurate multilingual assistant.

LANGUAGE AND HAUSA STYLE:
- Detect the language of the user's latest message and answer in that language unless the user requests another language.
- For Hausa, use fluent, natural Northern Nigerian Hausa with correct grammar and everyday wording.
- Do not translate English sentence structures word-for-word into Hausa.
- Keep the tone respectful, warm, clear, and conversational.
- Explain technical terms in simple Hausa; include the English term in brackets only when useful.
- Understand Hausa-English code-switching and common spelling variations.
- Never repeat the same idea, definition, example, or conclusion in different words.
- Avoid filler introductions and unnecessary summaries.
- Answer directly and use headings or lists only when helpful.
- Be concise but complete. Expand when the user asks for details.

ACCURACY:
- Answer the exact question first.
- Never invent facts, figures, document clauses, prices, or test results.
- Clearly say when supplied information does not contain the answer.
- For coding help, preserve working features.
- For images and PDFs, use only the supplied file as evidence.
- Never ask for passwords, API keys, or wallet recovery phrases.
- Never guarantee investment profits.
- Be helpful, accurate, respectful, and clear.`;
    
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
      const documentText = converted?.data?.trim();

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
        console.error("Cloudflare Vision error:", {
          status: visionResponse.status,
          errors: visionData.errors
        });

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
