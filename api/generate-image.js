
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
    
  
const imageRequest = prompt.trim();

let imagePrompt = imageRequest;

try {
  const translationResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You are Nexora AI's professional image-prompt understanding engine. " +
              "Understand image requests written in Hausa, English, and other languages. " +
              "Convert the user's request into a detailed, accurate English prompt for an image-generation model. " +
              "Preserve the exact subject, age, gender, number of people or animals, clothing, colors, " +
              "facial features, pose, action, objects, environment, background, lighting, camera angle, " +
              "composition, and artistic style requested by the user. " +
              "Never substitute the requested subject with a different person, animal, building, or object. " +
              "Do not invent unrelated subjects or ignore specific instructions. " +
              "Respect requested quantities, including unusual numbers of visible features. " +
              "For traditional Hausa clothing, accurately describe the requested babban riga, kaftan, cap, " +
              "and other specified garments. " +
              "For a child, depict a child; for an elderly man or woman, preserve the requested age and gender. " +
              "If the user requests a photograph, use photographic realism. If the user requests a drawing, " +
              "illustration, cartoon, or another style, follow that style instead. " +
              "Return only the final image prompt in English, without explanations."
          }]
        },
        contents: [{
          role: "user",
          parts: [{
            text: imageRequest
          }]
        }],
        generationConfig: {
          temperature: 0.1
        }
      })
    }
  );

  if (!translationResponse.ok) {
    console.error(
      "Gemini prompt processing failed:",
      translationResponse.status
    );
  } else {
    const translationData = await translationResponse.json();

    const translatedPrompt =
      translationData.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (translatedPrompt) {
      imagePrompt = translatedPrompt;
    }
  }
} catch (error) {
  console.error(
    "Nexora image prompt processing failed:",
    error.message
  );
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
