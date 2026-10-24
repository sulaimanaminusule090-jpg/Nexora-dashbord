
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
        error: "GEMINI_API_KEY is not configured."
      });
    }

    if (!audio || typeof audio !== "string") {
      return res.status(400).json({
        success: false,
        error: "Audio data is required."
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
      "audio/m4a",
      "audio/opus"
    ];

    const safeMimeType = allowedTypes.includes(mimeType)
      ? mimeType
      : "audio/webm";

    const audioBuffer = Buffer.from(audio, "base64");

    if (audioBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: "Recording is too large. Please record a shorter message."
      });
    }

   
    
    // Send audio directly to Gemini without uploading a separate file.
    const transcriptionResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  
text: "Transcribe the audio exactly in the original language spoken. Automatically identify the spoken language. Preserve its native writing system and script: use Arabic script for Arabic, Simplified or Traditional Chinese characters for Chinese as spoken, Cyrillic for Russian when spoken, and the appropriate native script for every other language. Do not translate, transliterate into Latin letters, or convert the speech into English. For Hausa, use standard Hausa Latin spelling. Return only the exact transcription, without explanations."
                  
                },
                {
                  inline_data: {
                    mime_type: safeMimeType,
                    data: audio
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const transcriptionResult = await transcriptionResponse.json();

    let transcript = "";

    if (transcriptionResponse.ok) {
      transcript =
        transcriptionResult.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim() || "";
    }

    if (!transcript) {
      console.error(
        "Direct audio transcription failed:",
        transcriptionResult
      );

      return res.status(502).json({
        success: false,
        error:
          transcriptionResult.error?.message ||
          "Voice transcription is temporarily unavailable. Please try again."
      });
    }
    
    

    if (!transcript) {
      return res.status(422).json({
        success: false,
        error: "No speech recognized. Please try again."
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
      error: "Unable to transcribe audio. Please try again."
    });
  }
};
