// api/debug-webhook.js - בדיקה מה BoldDesk שולח
module.exports = async (req, res) => {
    console.log('=== DEBUG WEBHOOK ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('===================');
    
    // תגובה פשוטה ביותר
    const html = `
        <div style="font-family: Arial; padding: 10px;">
            <div style="background: #f0f0f0; padding: 10px; border-radius: 5px;">
                <strong>Debug Info:</strong><br>
                Method: ${req.method}<br>
                Time: ${new Date().toLocaleString()}<br>
                Body Keys: ${req.body ? Object.keys(req.body).join(', ') : 'No body'}
            </div>
        </div>
    `;
    
    res.status(200).send(html);
};
