// api/index.js
module.exports = (req, res) => {
    if (req.method === 'POST') {
        // תגובה לBoldDesk
        const response = {
            "message": "<div style='padding: 10px; background: #28a745; color: white;'>✅ Connected to Hudu Integration</div>",
            "statusCode": "200"
        };
        res.status(200).json(response);
    } else {
        res.status(200).send('API is working');
    }
};
