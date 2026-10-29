
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { prompt } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Please describe the image you want."
      });
    }

    if (prompt.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Image prompt is too long."
      });
    }

    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!apiToken || !accountId || !geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "Cloudflare image generation is not configured."
      });
    }


let imagePrompt = prompt.trim();

try {
  const translationResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        contents: [{
          parts: [{
            text:
              

  "You are Nexora AI's image prompt translator. " +
"Translate the user's request into a precise English prompt. " +
"In Hausa, 'yaro' means boy, 'yarinya' means girl, " +
"'karamin yaro' means young boy, and 'fararen kaya' means white clothes. " +
"If the user requests a boy, the image MUST show a boy, never a girl. " +
"If the user requests a girl, the image MUST show a girl, never a boy. " +
"Preserve the requested age, gender, clothing, colors, number of people, " +
"action, background, and art style exactly. " +
"If the user requests white clothes, explicitly specify white clothing. " +
"If the user asks for a drawing, request an illustration rather than a photo. " +
"Never replace the main subject or add unrelated people. " +
"Return only the final English image prompt. " +
"User request: " + prompt.trim()
            
          }]
        }],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  if (translationResponse.ok) {
    const translationData = await translationResponse.json();

    const translatedPrompt =
      translationData.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (translatedPrompt) {
      imagePrompt = translatedPrompt;
    }
  } else {
    console.error(
      "Gemini translation unavailable:",
      translationResponse.status
    );
  }
} catch (error) {
  console.error("Gemini translation timed out or failed:", error.message);
}
    
 // Preserve the requested subject and clothing.
const originalPrompt = prompt.trim();
const imageConstraints = [];

if (/\byaro\b|\byaran\b|\bboy\b|\byoung boy\b/i.test(originalPrompt)) {
  imageConstraints.push(
    "The main subject MUST be a young boy, not a girl or woman."
  );
}

if (/\byarinya\b|\bgirl\b|\byoung girl\b/i.test(originalPrompt)) {
  imageConstraints.push(
    "The main subject MUST be a young girl, not a boy or man."
  );
}

if (/fararen kaya|fararen|white clothes|white clothing|wearing white/i.test(originalPrompt)) {
  imageConstraints.push(
    "The subject MUST wear white clothes, not colorful clothes."
  );
}

if (/zan[aein]|zane|drawing|draw|cartoon|illustration/i.test(originalPrompt)) {
  imageConstraints.push(
    "Create a drawn illustration, not a photorealistic portrait."
  );
}

if (imageConstraints.length > 0) {
  imagePrompt += "\n\nSTRICT REQUIREMENTS: " +
    imageConstraints.join(" ");
} 

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
  
prompt: imagePrompt,
steps: 8
          
})
      }
    );

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Cloudflare image API error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        success: false,
        error: `Cloudflare image API error (${response.status}). Check the Vercel logs.`
      });
    }

    let imageBuffer;
    let mimeType = "image/png";

    if (contentType.includes("application/json")) {
      const data = await response.json();

      const imageData = data?.result?.image;

      if (!data.success || !imageData) {
        console.error("Cloudflare returned no image.");
        return res.status(502).json({
          success: false,
          error: "No image was returned. Please try again."
        });
      }

      imageBuffer = Buffer.from(imageData, "base64");
    } else {
      imageBuffer = Buffer.from(await response.arrayBuffer());

      if (contentType.startsWith("image/")) {
        mimeType = contentType.split(";")[0];
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return res.status(502).json({
        success: false,
        error: "The generated image was empty."
      });
    }

    return res.status(200).json({
      success: true,
      image: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
      message: "Image generated successfully."
    });
  } catch (error) {
    console.error("Nexora image generation error:", error);

    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while generating the image."
    });
  }
};
