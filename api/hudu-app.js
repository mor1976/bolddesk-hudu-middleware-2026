// api/hudu-app.js - קובץ מלא ופשוט ל-Custom App של BoldDesk
const axios = require('axios');

// הגדרות מ-Environment Variables
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// זיכרון זמני לשמירת נתונים (בגלל ש-Vercel הוא stateless)
// בפרודקשן אמיתי כדאי להשתמש ב-Redis או מסד נתונים
const cache = new Map();

module.exports = async (req, res) => {
    // אפשר CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    console.log(`📨 ${req.method} request received`);
    console.log('Query params:', req.query);
    
    try {
        // אם זו בקשת POST - קבל נתונים מ-BoldDesk וחפש ב-Hudu
        if (req.method === 'POST') {
            console.log('POST Body:', JSON.stringify(req.body, null, 2));
            
            // חלץ את המייל מהנתונים
            const email = extractEmail(req.body);
            const ticketId = req.body?.ticketId || req.body?.id || 'unknown';
            
            console.log(`Found email: ${email}, Ticket ID: ${ticketId}`);
            
            if (email && HUDU_API_KEY && HUDU_BASE_URL) {
                // חפש ב-Hudu
                try {
                    const huduResponse = await axios.get(
                        `${HUDU_BASE_URL}/api/v1/assets`,
                        {
                            headers: {
                                'x-api-key': HUDU_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            params: { search: email }
                        }
                    );
                    
                    if (huduResponse.data?.assets?.length > 0) {
                        const asset = huduResponse.data.assets[0];
                        console.log(`✅ Found in Hudu: ${asset.name}`);
                        
                        // שמור בזיכרון
                        cache.set(ticketId, {
                            email: email,
                            asset: asset,
                            timestamp: Date.now()
                        });
                        
                        // נקה נתונים ישנים (יותר מ-5 דקות)
                        cleanOldCache();
                    } else {
                        console.log('❌ Not found in Hudu');
                        cache.set(ticketId, {
                            email: email,
                            notFound: true,
                            timestamp: Date.now()
                        });
                    }
                } catch (error) {
                    console.error('Hudu API error:', error.message);
                }
            }
            
            // החזר תגובה פשוטה ל-POST
            res.status(200).json({ success: true, message: 'Data received' });
            return;
        }
        
        // אם זו בקשת GET - הצג את המידע
        if (req.method === 'GET') {
            // נסה למצוא את ה-ticket ID מהפרמטרים
            const ticketId = req.query.ticketId || req.query.id || req.query.ticket || 'unknown';
            console.log(`GET request for ticket: ${ticketId}`);
            
            // חפש בזיכרון
            const data = cache.get(ticketId);
            
            // אם יש נתונים - הצג אותם
            if (data && data.asset) {
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                            margin: 0;
                            padding: 12px;
                            background: white;
                        }
                        .hudu-card {
                            border: 1px solid #e1e4e8;
                            border-radius: 8px;
                            overflow: hidden;
                        }
                        .hudu-header {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 10px 12px;
                            font-weight: 600;
                            font-size: 14px;
                        }
                        .hudu-body {
                            padding: 12px;
                        }
                        .info-item {
                            display: flex;
                            justify-content: space-between;
                            padding: 8px 0;
                            border-bottom: 1px solid #f0f0f0;
                            font-size: 13px;
                        }
                        .info-item:last-child {
                            border-bottom: none;
                        }
                        .label {
                            color: #586069;
                            font-weight: 500;
                        }
                        .value {
                            color: #24292e;
                            text-align: right;
                        }
                        .hudu-btn {
                            display: block;
                            width: 100%;
                            padding: 8px;
                            margin-top: 12px;
                            background: #28a745;
                            color: white;
                            text-align: center;
                            text-decoration: none;
                            border-radius: 6px;
                            font-size: 13px;
                            font-weight: 500;
                        }
                        .hudu-btn:hover {
                            background: #218838;
                        }
                        .success-badge {
                            display: inline-block;
                            background: rgba(255,255,255,0.2);
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-size: 11px;
                            margin-left: 8px;
                        }
                    </style>
                </head>
                <body>
                    <div class="hudu-card">
                        <div class="hudu-header">
                            🔗 Hudu Customer Info
                            <span class="success-badge">✓ Found</span>
                        </div>
                        <div class="hudu-body">
                            <div class="info-item">
                                <span class="label">👤 Name</span>
                                <span class="value">${data.asset.name}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">🏢 Company</span>
                                <span class="value">${data.asset.company_name}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">📧 Email</span>
                                <span class="value">${data.email}</span>
                            </div>
                            <div class="info-item">
                                <span class="label">🆔 Asset ID</span>
                                <span class="value">#${data.asset.id}</span>
                            </div>
                            <a href="${data.asset.url}" target="_blank" class="hudu-btn">
                                View in Hudu →
                            </a>
                        </div>
                    </div>
                </body>
                </html>`;
                
                res.status(200).send(html);
                return;
                
            } else if (data && data.notFound) {
                // אם חיפשנו ולא מצאנו
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 12px;
                        }
                        .not-found {
                            background: #fff3cd;
                            color: #856404;
                            padding: 12px;
                            border-radius: 6px;
                            border: 1px solid #ffeaa7;
                            text-align: center;
                            font-size: 13px;
                        }
                    </style>
                </head>
                <body>
                    <div class="not-found">
                        ⚠️ Customer not found in Hudu<br>
                        <small>${data.email}</small>
                    </div>
                </body>
                </html>`;
                
                res.status(200).send(html);
                return;
                
            } else {
                // אם אין נתונים בכלל
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 12px;
                        }
                        .loading {
                            background: #f0f0f0;
                            padding: 12px;
                            border-radius: 6px;
                            text-align: center;
                            font-size: 13px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="loading">
                        ⏳ Loading customer data...<br>
                        <small>Please refresh in a moment</small>
                    </div>
                </body>
                </html>`;
                
                res.status(200).send(html);
                return;
            }
        }
        
        // לכל שאר הבקשות
        res.status(200).send('BoldDesk-Hudu Integration Active');
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// פונקציה לחלץ מייל מהנתונים של BoldDesk
function extractEmail(data) {
    if (!data) return null;
    
    // נסה כל מיני מקומות אפשריים
    return data.requester?.EmailId ||
           data.requester?.email ||
           data.customer?.EmailId ||
           data.customer?.email ||
           data.contact?.email ||
           data.EmailId ||
           data.email ||
           null;
}

// נקה נתונים ישנים מהזיכרון (יותר מ-5 דקות)
function cleanOldCache() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const [key, value] of cache.entries()) {
        if (value.timestamp < fiveMinutesAgo) {
            cache.delete(key);
        }
    }
}
