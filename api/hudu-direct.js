// api/hudu-direct.js - תגובה ישירה ופשוטה
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// שומר את הנתון האחרון (כי BoldDesk לא שולח ID ב-GET)
let lastFoundAsset = null;

module.exports = async (req, res) => {
    console.log(`📨 ${req.method} request from BoldDesk`);
    
    // אם זה POST - חפש ב-Hudu
    if (req.method === 'POST') {
        console.log('POST Body:', JSON.stringify(req.body, null, 2));
        
        // מצא את המייל
        const email = findEmail(req.body);
        console.log('Email found:', email);
        
        if (email && HUDU_API_KEY && HUDU_BASE_URL) {
            try {
                // חפש ב-Hudu
                const response = await axios.get(
                    `${HUDU_BASE_URL}/api/v1/assets`,
                    {
                        headers: {
                            'x-api-key': HUDU_API_KEY,
                            'Content-Type': 'application/json'
                        },
                        params: { search: email }
                    }
                );
                
                if (response.data?.assets?.length > 0) {
                    lastFoundAsset = {
                        ...response.data.assets[0],
                        email: email
                    };
                    console.log(`✅ Found: ${lastFoundAsset.name}`);
                } else {
                    lastFoundAsset = { notFound: true, email: email };
                    console.log('❌ Not found in Hudu');
                }
            } catch (error) {
                console.error('Hudu error:', error.message);
                lastFoundAsset = { error: error.message };
            }
        } else {
            lastFoundAsset = { noEmail: true };
        }
        
        // תמיד החזר success ל-POST
        res.status(200).json({ success: true });
        return;
    }
    
    // אם זה GET - הצג את הנתון האחרון
    if (req.method === 'GET') {
        console.log('GET request - returning last found data');
        
        // אם יש נתון שמור
        if (lastFoundAsset && !lastFoundAsset.notFound && !lastFoundAsset.error && !lastFoundAsset.noEmail) {
            const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 8px; }
    .card {
        border: 1px solid #d0d7de;
        border-radius: 6px;
        overflow: hidden;
    }
    .header {
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        color: white;
        padding: 8px 10px;
        font-size: 13px;
        font-weight: 600;
    }
    .body { padding: 10px; }
    .row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 12px;
        border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child { border: none; }
    .label { color: #57606a; }
    .value { color: #0969da; font-weight: 500; }
    .btn {
        display: block;
        width: 100%;
        padding: 6px;
        margin-top: 8px;
        background: #2da44e;
        color: white;
        text-align: center;
        text-decoration: none;
        border-radius: 4px;
        font-size: 12px;
    }
</style>
</head>
<body>
<div class="card">
    <div class="header">✅ Customer Found in Hudu</div>
    <div class="body">
        <div class="row">
            <span class="label">Name:</span>
            <span class="value">${lastFoundAsset.name}</span>
        </div>
        <div class="row">
            <span class="label">Company:</span>
            <span class="value">${lastFoundAsset.company_name}</span>
        </div>
        <div class="row">
            <span class="label">Email:</span>
            <span class="value">${lastFoundAsset.email}</span>
        </div>
        <a href="${lastFoundAsset.url}" target="_blank" class="btn">Open in Hudu →</a>
    </div>
</div>
</body>
</html>`;
            res.status(200).send(html);
            
        } else if (lastFoundAsset && lastFoundAsset.notFound) {
            // לא נמצא
            res.status(200).send(`
                <div style="padding:10px; background:#fff3cd; border:1px solid #ffc107; border-radius:4px; font-size:12px; text-align:center;">
                    ⚠️ Customer not found<br>
                    <small>${lastFoundAsset.email}</small>
                </div>
            `);
            
        } else {
            // אין נתונים
            res.status(200).send(`
                <div style="padding:10px; background:#f8f9fa; border-radius:4px; font-size:12px; color:#6c757d; text-align:center;">
                    Loading...
                </div>
            `);
        }
        return;
    }
    
    // Default
    res.status(200).send('Hudu Integration Active');
};

// פונקציה למציאת מייל
function findEmail(data) {
    if (!data) return null;
    
    // חפש בכל המקומות האפשריים
    const paths = [
        'requester.EmailId',
        'requester.email',
        'customer.EmailId', 
        'customer.email',
        'contact.email',
        'EmailId',
        'email'
    ];
    
    for (const path of paths) {
        const parts = path.split('.');
        let value = data;
        
        for (const part of parts) {
            if (value && value[part]) {
                value = value[part];
            } else {
                value = null;
                break;
            }
        }
        
        if (value && value.includes('@')) {
            return value;
        }
    }
    
    return null;
}
