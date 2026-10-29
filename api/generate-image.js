
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
"Preserve the requested age, gender, clothing, colors, number of people, action, and background. " +
"Do not infer anime, cartoon, chibi, or illustration from the Hausa verb 'zana' alone. " +
"If the user says 'ba anime ba', 'kamannin mutum na yau da kullum', 'hoton gaske', 'realistic', or 'photorealistic', request a photorealistic image of a real-looking human, not an illustration. " +
"Only use anime, cartoon, chibi, or illustration when the user explicitly requests that style. " +
"If the user requests white clothes, explicitly specify white clothing. " +

"Unless the user explicitly requests anime, cartoon, chibi, or another stylized art style, use realistic human proportions and natural facial features. " +
"For human subjects, use realistic human proportions: a normally sized head, natural face, anatomically proportionate body, realistic hands and legs. Avoid oversized heads, tiny bodies, chibi, caricature, and toy-like proportions. " +
"If the user asks for a realistic image, generate a photorealistic image rather than a cartoon or illustration. " +
"If the user requests white clothes, keep all visible clothing white and do not add contrasting garments unless requested. " +
              
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
    "Show one young boy as the main subject."
  );
}

if (/\byarinya\b|\bgirl\b|\byoung girl\b/i.test(originalPrompt)) {
  imageConstraints.push(
    "Show one young girl as the main subject."
  );
}

if (/fararen kaya|fararen|white clothes|white clothing|wearing white/i.test(originalPrompt)) {
  imageConstraints.push(
    "Dress the subject in white clothes."
  );
}



if (imageConstraints.length > 0) {
  imagePrompt += "\n\nAdditional visual details: " +
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
