
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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Image generation is not configured."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Generate an image based on this request: " +
                prompt.trim()
            }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Image API error:", data?.error?.message);
      return res.status(502).json({
        success: false,
        error: "Could not generate the image. Please try again."
      });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(
      part => part.inlineData?.data
    );

    if (!imagePart) {
      return res.status(502).json({
        success: false,
        error: "No image was returned. Please try another prompt."
      });
    }

    return res.status(200).json({
      success: true,
      image: "data:" +
        imagePart.inlineData.mimeType +
        ";base64," +
        imagePart.inlineData.data,
      message: parts
        .filter(part => part.text)
        .map(part => part.text)
        .join("\n")
    });
  } catch (error) {
    console.error("Nexora image generation error:", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred."
    });
  }
};
