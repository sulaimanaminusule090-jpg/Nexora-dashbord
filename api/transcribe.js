
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

   
    const uploadStartResponse = await fetch(
      "https://generativelanguage.googleapis.com/upload/v1beta/files",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(audioBuffer.length),
          "X-Goog-Upload-Header-Content-Type": safeMimeType,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file: {
            display_name: "nexora-voice-recording"
          }
        })
      }
    );

    if (!uploadStartResponse.ok) {
      const startError = await uploadStartResponse.json();
      return res.status(502).json({
        success: false,
        error: startError.error?.message || "Could not start audio upload."
      });
    }

    const uploadUrl =
      uploadStartResponse.headers.get("x-goog-upload-url");

    if (!uploadUrl) {
      return res.status(502).json({
        success: false,
        error: "Google did not return an audio upload URL."
      });
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
        "Content-Type": safeMimeType
      },
      body: audioBuffer
    });

    const uploaded = await uploadResponse.json();
    

    if (!uploadResponse.ok || !uploaded.file?.uri) {
      console.error("Audio upload failed:", uploaded);

      return res.status(502).json({
        success: false,
        error: uploaded.error?.message || "Audio upload failed."
      });
    }

    const transcriptionResponse = await fetch(
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
              type: "audio",
              uri: uploaded.file.uri,
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

    const result = await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      console.error("Transcription failed:", result);

      return res.status(502).json({
        success: false,
        error: result.error?.message || "Transcription failed."
      });
    }

    const transcript = result.output_text?.trim();

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
