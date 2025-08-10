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
        console.log('=== WEBHOOK RECEIVED ===');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body type:', typeof req.body);
        console.log('Raw body:', JSON.stringify(req.body, null, 2));
        
        // Try to parse customer email from different possible formats
        let customerEmail = null;
        let ticketData = req.body;
        
        // אם הגוף הוא מחרוזת, ננסה לפרסר אותו
        if (typeof ticketData === 'string') {
            try {
                ticketData = JSON.parse(ticketData);
                console.log('Parsed string body to JSON');
            } catch (e) {
                console.log('Failed to parse string body:', e.message);
            }
        }
        
        // חיפוש מקיף של המייל בכל המבנים האפשריים
        function findEmail(obj) {
            if (!obj) return null;
            
            // חיפוש ישיר - כולל EmailId שBoldDesk שולח!
            if (obj.email) return obj.email;
            if (obj.Email) return obj.Email;
            if (obj.EmailId) return obj.EmailId;  // הוספנו את זה!
            if (obj.customer_email) return obj.customer_email;
            if (obj.requester_email) return obj.requester_email;
            
            // חיפוש במבנים מקוננים - כולל requester.EmailId
            if (obj.customer?.email) return obj.customer.email;
            if (obj.Customer?.Email) return obj.Customer.Email;
            if (obj.requester?.email) return obj.requester.email;
            if (obj.requester?.EmailId) return obj.requester.EmailId;  // הוספנו את זה!
            if (obj.Requester?.Email) return obj.Requester.Email;
            if (obj.Requester?.EmailId) return obj.Requester.EmailId;  // הוספנו את זה!
            if (obj.ticket?.customer?.email) return obj.ticket.customer.email;
            if (obj.Ticket?.Customer?.Email) return obj.Ticket.Customer.Email;
            if (obj.contact?.email) return obj.contact.email;
            if (obj.Contact?.Email) return obj.Contact.Email;
            
            // חיפוש רקורסיבי בכל המפתחות
            for (let key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found = findEmail(obj[key]);
                    if (found) return found;
                }
            }
            
            return null;
        }
        
        customerEmail = findEmail(ticketData);
        
        console.log('Extracted email:', customerEmail);
        console.log('Full ticket data structure:', JSON.stringify(ticketData, null, 2));
        
        // אם מצאנו מייל, נחפש ב-Hudu
        let huduAssets = null;
        if (customerEmail && HUDU_API_KEY && HUDU_BASE_URL) {
            try {
                console.log('Searching Hudu for email:', customerEmail);
                const huduResponse = await axios.get(
                    `${HUDU_BASE_URL}/api/v1/assets`,
                    {
                        headers: {
                            'x-api-key': HUDU_API_KEY,
                            'Content-Type': 'application/json'
                        },
                        params: {
                            search: customerEmail
                        }
                    }
                );
                huduAssets = huduResponse.data;
                console.log('Hudu search results:', huduAssets);
            } catch (huduError) {
                console.error('Hudu search error:', huduError.message);
            }
        }
        
        // תמיד מחזירים תגובת JSON תקינה ל-BoldDesk
        const response = {
            success: true,
            message: customerEmail ? 
                `Customer email found: ${customerEmail}` : 
                'Webhook received but no customer email found',
            data: {
                customerEmail: customerEmail,
                timestamp: new Date().toISOString(),
                huduConnected: !!(HUDU_API_KEY && HUDU_BASE_URL),
                huduAssetsFound: huduAssets?.assets?.length || 0
            }
        };
        
        console.log('Sending response:', JSON.stringify(response, null, 2));
        
        // חשוב: מחזירים JSON ולא HTML ל-BoldDesk
        res.status(200).json(response);
        
    } catch (error) {
        console.error('=== WEBHOOK ERROR ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        
        // גם בשגיאה, מחזירים JSON תקין
        const errorResponse = {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
        
        res.status(200).json(errorResponse); // שימוש ב-200 גם בשגיאה כדי ש-BoldDesk לא ינסה שוב
    }
});

// Test endpoint - עם HTML ידידותי לבדיקה
app.get('/test', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>BoldDesk-Hudu Test</title>
        <style>
            body { font-family: Arial; padding: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status { padding: 15px; border-radius: 5px; margin: 20px 0; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔧 BoldDesk-Hudu Integration Test</h1>
            
            <div class="status ${BOLDDESK_API_KEY ? 'success' : 'warning'}">
                <strong>BoldDesk API:</strong> ${BOLDDESK_API_KEY ? '✅ Configured' : '⚠️ Not configured'}
            </div>
            
            <div class="status ${HUDU_API_KEY ? 'success' : 'warning'}">
                <strong>Hudu API:</strong> ${HUDU_API_KEY ? '✅ Configured' : '⚠️ Not configured'}
            </div>
            
            <div class="status ${HUDU_BASE_URL ? 'success' : 'warning'}">
                <strong>Hudu URL:</strong> ${HUDU_BASE_URL || 'Not configured'}
            </div>
            
            <h2>Test Webhook</h2>
            <button onclick="testWebhook()">Send Test Webhook</button>
            
            <div id="result"></div>
            
            <script>
                async function testWebhook() {
                    const testData = {
                        ticket: {
                            id: "TEST-001",
                            subject: "Test Ticket",
                            customer: {
                                email: "test@example.com",
                                name: "Test User"
                            }
                        }
                    };
                    
                    try {
                        const response = await fetch('/bolddesk-webhook', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(testData)
                        });
                        
                        const result = await response.json();
                        document.getElementById('result').innerHTML = 
                            '<h3>Response:</h3><pre>' + JSON.stringify(result, null, 2) + '</pre>';
                    } catch (error) {
                        document.getElementById('result').innerHTML = 
                            '<div class="status error">Error: ' + error.message + '</div>';
                    }
                }
            </script>
        </div>
    </body>
    </html>
    `;
    res.send(html);
});

// Test endpoint with specific email
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
        console.log(`📝 Test interface: http://localhost:${PORT}/test`);
    });
}

// Export for Vercel
module.exports = app;
