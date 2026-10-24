
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text:
                "Read this text aloud in its original language. Do not translate it: " +
                text.trim().slice(0, 4000)
            }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Kore"
                }
              }
            }
          }
        })
      }
    );

    const result = await response.json();
    const parts =
      result.candidates?.[0]?.content?.parts || [];
    const audioPart =
      parts.find(part => part.inlineData?.data);

    if (!response.ok || !audioPart) {
      console.error("TTS error:", result);
      return res.status(502).json({
        success: false,
        error:
          result.error?.message ||
          "Speech generation failed. Please try again."
      });
    }

    const pcm = Buffer.from(
      audioPart.inlineData.data,
      "base64"
    );

    // Wrap the 24 kHz, 16-bit mono PCM audio in a WAV header.
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const wav = Buffer.alloc(44 + pcm.length);

    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + pcm.length, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(
      sampleRate * channels * bitsPerSample / 8,
      28
    );
    wav.writeUInt16LE(
      channels * bitsPerSample / 8,
      32
    );
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(pcm.length, 40);
    pcm.copy(wav, 44);

    return res.status(200).json({
      success: true,
      audio: wav.toString("base64"),
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
