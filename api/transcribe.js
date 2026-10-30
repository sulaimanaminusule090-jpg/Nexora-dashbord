
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
                  
text: "You are an expert multilingual speech transcription system. Listen carefully to the entire audio from beginning to end. Accurately transcribe every spoken word without skipping, shortening, summarizing, or translating anything. Give special attention to Hausa spoken in Northern Nigeria. Recognize natural Hausa pronunciation, Hausa greetings, common Hausa expressions, and Hausa-English code-switching. When the speaker talks in Hausa, write the complete transcription in standard Hausa Latin spelling. Do not mistake Hausa for English or another language. Preserve the original language of every sentence. Return only the complete transcription, with no explanations."
                  
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
