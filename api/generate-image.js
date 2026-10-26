
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
              

  "Translate the user's image request into a precise English prompt for an image generator. " +
  "The exact main subject requested by the user is mandatory. " +
  "A child means a child, never an adult. An elderly person means an elderly person. " +
  "A woman means a woman. Never replace the requested subject with a different person or object. " +
  "Preserve the requested number of people, clothing, action, setting, and style. " +
  "Do not add unrelated objects or events. Return only the final English image prompt. " +
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
    
  
const originalRequest = prompt.trim().toLowerCase();

if (/\b(akuya|awaki|goat|goats)\b/i.test(originalRequest)) {
  imagePrompt =
    "A realistic photograph of a GOAT, the animal, with four legs, " +
    "two visible horns, goat ears, and a goat face. The goat is the main " +
    "subject and clearly recognizable as a goat. Do not show any human, " +
    "person, sheep, or other animal. " +
    "Additional user request: " + prompt.trim();
}

if (/kayan hausawa|kayan hausa|hausa traditional clothes|traditional hausa attire/i.test(originalRequest)) {
  imagePrompt +=
    ". The child must wear authentic traditional Hausa clothing, " +
    "including a Hausa babban riga or kaftan and a matching Hausa cap. " +
    "The clothing must be clearly visible and culturally recognizable.";
}
    
if (/\b(yaro|yaran|yarinya|yarinya|child|kid|boy|girl)\b/i.test(originalRequest)) {
  imagePrompt +=
    ". IMPORTANT: The main subject must be a young child, approximately 6 to 8 years old, " +
    "with clearly childlike facial features and body proportions. " +
    "Do not depict an adult, teenager, or elderly person. " +
    "The child must be the main subject of the image.";
}


if (/\b(tsohuwa|dattuwa|tsohuwar mace|elderly woman|old woman|old lady)\b/i.test(originalRequest)) {
    imagePrompt +=
        ". The main subject MUST be an elderly WOMAN, clearly female, " +
        "with visibly aged facial features, realistic wrinkles, and an elderly woman's appearance. " +
        "Do NOT depict a man, elderly man, child, or young adult.";
} else if (/\b(tsoho|dattijo|dattijon|tsohon mutum|tsohon namiji|elderly man|old man|old male)\b/i.test(originalRequest)) {
    imagePrompt +=
        ". The main subject MUST be an elderly MAN, clearly male, " +
        "with visibly aged facial features and an elderly man's appearance. " +
        "Do NOT depict a woman, elderly woman, child, or young adult.";
}
    
    
if (/\b(gida|gidaje|house|houses|home|homes)\b/i.test(originalRequest)) {
    imagePrompt =
        "A realistic photograph of a house building as the main subject. " +
        "Show the complete house clearly, including its walls, roof, doors, and windows. " +
        "Do not show any person as the main subject. " +
        "Do not replace the house with an unrelated object. " +
        "User's additional request: " + prompt.trim();
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
