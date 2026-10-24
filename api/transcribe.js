
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { audio, mimeType } = req.body || {};

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "Gemini API key is not configured."
      });
    }

    if (!audio || typeof audio !== "string") {
      return res.status(400).json({
        success: false,
        error: "Audio data is required."
      });
    }

    if (audio.length > 3000000) {
      return res.status(413).json({
        success: false,
        error: "Recording is too large. Please record a shorter message."
      });
    }

    const allowedTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/aac",
      "audio/mp3",
      "audio/m4a"
    ];

    const safeMimeType = allowedTypes.includes(mimeType)
      ? mimeType
      : "audio/webm";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.5-transcribe",
          input: [
            {
              type: "text",
              text: "Transcribe the spoken audio accurately in its original language. Automatically detect the language. Support Hausa, English, Arabic, French, and other supported languages. Do not translate. Return only the spoken words, without explanations."
            },
            {
              type: "audio",
              data: audio,
              mime_type: safeMimeType
            }
          ],
          generation_config: {
            transcription_config: {
              mode: "smart",
              language_codes: []
            }
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Transcription API error:", result);

      return res.status(response.status).json({
        success: false,
        error: result.error?.message ||
          "Transcription failed. Please try again."
      });
    }

    const transcript = result.output_text?.trim();

    if (!transcript) {
      return res.status(502).json({
        success: false,
        error: "No speech was recognized. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      transcript
    });
  } catch (error) {
    console.error("Transcription error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to transcribe audio. Check your connection and try again."
    });
  }
};
