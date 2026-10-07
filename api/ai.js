export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    try {
        const { message } = req.body || {};

        if (!message || typeof message !== "string") {
            return res.status(400).json({
                success: false,
                error: "Message is required"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Nexora AI backend is connected.",
            received: message
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}
