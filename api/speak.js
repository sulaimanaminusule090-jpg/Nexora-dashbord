
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { text } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured."
      });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash-lite-tts",
          input: [
            {
              type: "user_input",
              content: [
                {
                  type: "text",
                  text: text.trim().slice(0, 4000),
                  annotations: [
                    {
                      type: "speech_metadata",
                      style: "Speak naturally and clearly in the original language. Do not translate."
                    }
                  ]
                }
              ]
            }
          ],
          response_format: {
            type: "audio"
          },
          generation_config: {
            speech_config: [
              {
                voice: "Kore"
              }
            ]
          }
        })
      }
    );

    const result = await response.json();

    const audioPart = (result.steps || [])
      .filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .find(part => part.type === "audio" && part.data);

    if (!response.ok || !audioPart) {
      console.error("TTS error:", result);

      return res.status(response.status === 429 ? 429 : 502).json({
        success: false,
        error:
          result.error?.message ||
          "Speech generation failed. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      audio: audioPart.data,
      mimeType: "audio/wav"
    });
  } catch (error) {
    console.error("Speech error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to generate speech. Please try again."
    });
  }
};
