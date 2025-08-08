const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - מתוקן לטפל בכל סוגי הנתונים!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.raw());
app.use(cors());

// Configuration
const BOLDDESK_API_KEY = process.env.BOLDDESK_API_KEY;
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'BoldDesk-Hudu Middleware'
    });
});

// Main endpoint for BoldDesk webhook - מתוקן!
app.post('/bolddesk-webhook', async (req, res) => {
    try {
        console.log('Received request from BoldDesk');
        console.log('Headers:', req.headers);
        console.log('Body type:', typeof req.body);
        console.log('Body content:', req.body);
        
        // Try to parse customer email from different possible formats
        let customerEmail = null;
        let ticketData = null;
        
        try {
            // If body is string, try to parse as JSON
            if (typeof req.body === 'string') {
                ticketData = JSON.parse(req.body);
            } else if (typeof req.body === 'object') {
                ticketData = req.body;
            }
            
            // Extract email from various possible locations
            if (ticketData) {
                customerEmail = ticketData.customer?.email || 
                               ticketData.ticket?.customer?.email ||
                               ticketData.email ||
                               ticketData.customer_email;
            }
        } catch (parseError) {
            console.log('Parse error:', parseError.message);
        }
        
        console.log('Extracted email:', customerEmail);
        
        // Generate HTML response
        const htmlResponse = `
            <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px;">🎉 החיבור עובד מעולה!</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">השרת קיבל נתונים מ-BoldDesk בהצלחה</p>
                </div>
                
                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h3 style="color: #333; margin-top: 0;">פרטי הבקשה:</h3>
                    <p><strong>זמן:</strong> ${new Date().toLocaleString('he-IL')}</p>
                    <p><strong>מייל לקוח:</strong> ${customerEmail || 'לא נמצא'}</p>
                    <p><strong>סטטוס Hudu:</strong> ${HUDU_API_KEY ? '✅ מחובר' : '❌ לא מחובר'}</p>
                </div>
                
                ${customerEmail ? `
                <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #2e7d32;">
                        <strong>✅ נמצא מייל לקוח:</strong> ${customerEmail}<br>
                        <strong>🔍 הבא:</strong> חיפוש נכסים ב-Hudu למייל הזה
                    </p>
                </div>
                ` : `
                <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #e65100;">
                        <strong>⚠️ לא נמצא מייל לקוח בנתונים</strong><br>
                        השרת עובד, אבל צריך לוודא שBoldDesk שולח את פרטי הלקוח
                    </p>
                </div>
                `}
                
                <div style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 8px; border: 1px solid #e3f2fd;">
                    <details style="color: #1565C0;">
                        <summary style="cursor: pointer; font-weight: bold;">🔧 פרטים טכניים</summary>
                        <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin-top: 10px;">${JSON.stringify(ticketData || req.body, null, 2)}</pre>
                    </details>
                </div>
            </div>
        `;
        
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlResponse);
        
    } catch (error) {
        console.error('Webhook error:', error);
        const errorHTML = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <div style="background: #ffebee; border: 1px solid #f44336; border-radius: 8px; padding: 15px;">
                    <h3 style="color: #d32f2f; margin-top: 0;">שגיאה בעיבוד</h3>
                    <p style="color: #d32f2f;">שגיאה: ${error.message}</p>
                    <p style="color: #666; font-size: 12px;">זמן: ${new Date().toLocaleString('he-IL')}</p>
                </div>
            </div>
        `;
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.status(500).send(errorHTML);
    }
});

// Test endpoint
app.get('/test/:email', (req, res) => {
    const email = req.params.email;
    res.json({
        email: email,
        status: 'success',
        message: 'Test endpoint working',
        hudu_api_key: HUDU_API_KEY ? 'Set' : 'Missing',
        hudu_url: HUDU_BASE_URL || 'Missing',
        timestamp: new Date().toISOString()
    });
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
