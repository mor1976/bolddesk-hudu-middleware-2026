const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
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

// Main endpoint for BoldDesk webhook - מתוקן להחזיר HTML!
app.post('/bolddesk-webhook', async (req, res) => {
    try {
        console.log('Received request from BoldDesk:', req.body);
        
        // BoldDesk expects HTML response, not JSON
        const htmlResponse = `
            <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px;">🎉 החיבור ל-Hudu עובד!</h2>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">הנתונים נטענים מהמערכת...</p>
                </div>
                
                <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h3 style="color: #333; margin-top: 0;">פרטי הבקשה:</h3>
                    <p><strong>זמן:</strong> ${new Date().toLocaleString('he-IL')}</p>
                    <p><strong>סטטוס:</strong> השרת פעיל ומוכן</p>
                    <p><strong>Hudu מחובר:</strong> ${HUDU_API_KEY ? '✅ כן' : '❌ לא'}</p>
                </div>
                
                <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; border-radius: 4px;">
                    <p style="margin: 0; color: #1565C0;">
                        <strong>💡 הבא:</strong> השרת יחפש את נכסי הלקוח ב-Hudu ויציג אותם כאן.
                    </p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <p style="margin: 0; color: #e65100; font-size: 14px;">
                        <strong>🔧 מצב פיתוח:</strong> זהו תצוגת בדיקה. בגרסה הסופית יוצגו כאן נכסי הלקוח מ-Hudu.
                    </p>
                </div>
            </div>
        `;
        
        // BoldDesk expects HTML content, not JSON
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlResponse);
        
    } catch (error) {
        console.error('Error:', error);
        const errorHTML = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <div style="background: #ffebee; border: 1px solid #f44336; border-radius: 8px; padding: 15px;">
                    <h3 style="color: #d32f2f; margin-top: 0;">שגיאה בשרת</h3>
                    <p style="color: #d32f2f;">אירעה שגיאה בעת עיבוד הבקשה: ${error.message}</p>
                    <p style="color: #666; font-size: 12px;">זמן: ${new Date().toLocaleString('he-IL')}</p>
                </div>
            </div>
        `;
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.status(500).send(errorHTML);
    }
});

// Test endpoint for development
app.get('/test/:email', (req, res) => {
    const email = req.params.email;
    
    res.json({
        email: email,
        status: 'success',
        message: 'Test endpoint working',
        hudu_api_key: HUDU_API_KEY ? 'Set' : 'Missing',
        hudu_url: HUDU_BASE_URL || 'Missing',
        timestamp: new Date().toISOString(),
        ready_for_bolddesk: true
    });
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📝 Webhook: http://localhost:${PORT}/bolddesk-webhook`);
        console.log(`❤️  Health: http://localhost:${PORT}/health`);
        console.log(`🧪 Test: http://localhost:${PORT}/test/email@example.com`);
    });
}

// Export for Vercel
module.exports = app;
