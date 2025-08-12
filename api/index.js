// api/index.js - Complete BoldDesk-Hudu Integration
const axios = require('axios');

// Load environment variables
const BOLDDESK_API_KEY = process.env.BOLDDESK_API_KEY;
const BOLDDESK_BASE_URL = process.env.BOLDDESK_BASE_URL || 'https://morget-morco.bolddesk.com';
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Helper function to update BoldDesk ticket with Hudu info
async function updateBoldDeskWithHuduInfo(ticketId, huduAsset) {
    if (!BOLDDESK_API_KEY) {
        console.log('BoldDesk API key not configured - skipping update');
        return null;
    }
    
    try {
        // Prepare the note content
        const noteContent = `
🔗 **מידע לקוח מ-Hudu:**

👤 **שם:** ${huduAsset.name}
🏢 **חברה:** ${huduAsset.company_name}
🆔 **מזהה נכס:** #${huduAsset.id}
🔗 **קישור:** [פתח ב-Hudu](${huduAsset.url})

✅ הלקוח אומת בהצלחה במערכת Hudu
        `.trim();
        
        // Add note to ticket
        const noteResponse = await axios.post(
            `${BOLDDESK_BASE_URL}/api/v1/tickets/${ticketId}/notes`,
            {
                content: noteContent,
                isPrivate: true // Internal note for agents only
            },
            {
                headers: {
                    'x-api-key': BOLDDESK_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Note added to BoldDesk ticket');
        
        // Update custom fields if they exist
        try {
            const customFieldsUpdate = {
                customFields: {
                    cf_hudu_asset_id: String(huduAsset.id),
                    cf_hudu_company: huduAsset.company_name,
                    cf_hudu_verified: "Yes"
                }
            };
            
            await axios.patch(
                `${BOLDDESK_BASE_URL}/api/v1/tickets/${ticketId}`,
                customFieldsUpdate,
                {
                    headers: {
                        'x-api-key': BOLDDESK_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('Custom fields updated in BoldDesk');
        } catch (cfError) {
            console.log('Could not update custom fields (they might not exist):', cfError.message);
        }
        
        return { success: true, message: 'BoldDesk ticket updated with Hudu info' };
        
    } catch (error) {
        console.error('Error updating BoldDesk:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Main handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const path = req.url.split('?')[0];
    
    // Main webhook endpoint
    if (path === '/bolddesk-webhook' && req.method === 'POST') {
        try {
            console.log('=== WEBHOOK RECEIVED ===');
            console.log('Timestamp:', new Date().toISOString());
            
            let ticketData = req.body;
            
            // Parse body if string
            if (typeof ticketData === 'string') {
                try {
                    ticketData = JSON.parse(ticketData);
                } catch (e) {
                    console.log('Parse error:', e.message);
                }
            }
            
            console.log('Ticket ID:', ticketData.ticketId);
            console.log('Subject:', ticketData.subject);
            
            // Find customer email
            function findEmail(obj) {
                if (!obj) return null;
                
                // Check all possible email locations
                if (obj.email) return obj.email;
                if (obj.Email) return obj.Email;
                if (obj.EmailId) return obj.EmailId;
                if (obj.requester?.EmailId) return obj.requester.EmailId;
                if (obj.requester?.email) return obj.requester.email;
                if (obj.customer?.email) return obj.customer.email;
                if (obj.customer?.EmailId) return obj.customer.EmailId;
                
                // Recursive search
                for (let key in obj) {
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        const found = findEmail(obj[key]);
                        if (found) return found;
                    }
                }
                
                return null;
            }
            
            const customerEmail = findEmail(ticketData);
            console.log('Customer email:', customerEmail || 'Not found');
            
            let huduAsset = null;
            let bolddeskUpdateResult = null;
            
            // Search in Hudu if email found
            if (customerEmail && HUDU_API_KEY && HUDU_BASE_URL) {
                try {
                    console.log('Searching Hudu for:', customerEmail);
                    
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
                    
                    if (huduResponse.data?.assets?.length > 0) {
                        huduAsset = huduResponse.data.assets[0];
                        console.log(`Found Hudu asset: ${huduAsset.name} (ID: ${huduAsset.id})`);
                        
                        // Update BoldDesk ticket with Hudu info
                        if (ticketData.ticketId) {
                            bolddeskUpdateResult = await updateBoldDeskWithHuduInfo(
                                ticketData.ticketId, 
                                huduAsset
                            );
                        }
                    } else {
                        console.log('No assets found in Hudu for this email');
                    }
                    
                } catch (huduError) {
                    console.error('Hudu error:', huduError.message);
                }
            }
            
            // Prepare response
            const response = {
                success: true,
                message: customerEmail ? 
                    `Customer email found: ${customerEmail}` : 
                    'Webhook received but no customer email found',
                data: {
                    ticketId: ticketData.ticketId,
                    customerEmail: customerEmail,
                    timestamp: new Date().toISOString(),
                    huduAsset: huduAsset ? {
                        found: true,
                        name: huduAsset.name,
                        company: huduAsset.company_name,
                        id: huduAsset.id,
                        url: huduAsset.url
                    } : { found: false },
                    bolddeskUpdated: bolddeskUpdateResult?.success || false
                }
            };
            
            console.log('=== WEBHOOK COMPLETED ===');
            console.log('Hudu asset found:', !!huduAsset);
            console.log('BoldDesk updated:', bolddeskUpdateResult?.success || false);
            
            res.status(200).json(response);
            
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(200).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        return;
    }
    
    // Health check endpoint
    if (path === '/health' && req.method === 'GET') {
        // Test connections
        let bolddeskStatus = 'Not configured';
        let huduStatus = 'Not configured';
        
        // Test BoldDesk connection
        if (BOLDDESK_API_KEY) {
            try {
                await axios.get(
                    `${BOLDDESK_BASE_URL}/api/v1/tickets?limit=1`,
                    {
                        headers: { 'x-api-key': BOLDDESK_API_KEY },
                        timeout: 5000
                    }
                );
                bolddeskStatus = 'Connected';
            } catch (e) {
                bolddeskStatus = 'Error: ' + e.message;
            }
        }
        
        // Test Hudu connection
        if (HUDU_API_KEY && HUDU_BASE_URL) {
            try {
                await axios.get(
                    `${HUDU_BASE_URL}/api/v1/companies?limit=1`,
                    {
                        headers: { 'x-api-key': HUDU_API_KEY },
                        timeout: 5000
                    }
                );
                huduStatus = 'Connected';
            } catch (e) {
                huduStatus = 'Error: ' + e.message;
            }
        }
        
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'BoldDesk-Hudu Middleware',
            config: {
                bolddesk: bolddeskStatus,
                hudu: huduStatus,
                hudu_url: HUDU_BASE_URL || 'Not set'
            }
        });
        return;
    }
    
    // Root endpoint
    if (path === '/' && req.method === 'GET') {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>BoldDesk-Hudu Integration</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    margin: 0;
                    padding: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 600px;
                }
                h1 {
                    color: #333;
                    margin-bottom: 10px;
                }
                .status {
                    display: inline-block;
                    padding: 8px 16px;
                    margin: 10px 5px;
                    border-radius: 20px;
                    font-size: 14px;
                }
                .status.active {
                    background: #d4edda;
                    color: #155724;
                }
                .status.inactive {
                    background: #f8d7da;
                    color: #721c24;
                }
                .links {
                    margin-top: 30px;
                }
                a {
                    display: inline-block;
                    margin: 10px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: transform 0.2s;
                }
                a:hover {
                    transform: translateY(-2px);
                }
                .info {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    text-align: left;
                }
                code {
                    background: #e9ecef;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 14px;
                }
                .success-msg {
                    background: #d4edda;
                    color: #155724;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border: 1px solid #c3e6cb;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔗 BoldDesk-Hudu Integration</h1>
                <p>Webhook Service is Running!</p>
                
                <div class="success-msg">
                    ✅ המערכת פעילה ומוכנה לקבל webhooks
                </div>
                
                <div>
                    <span class="status ${BOLDDESK_API_KEY ? 'active' : 'inactive'}">
                        BoldDesk API: ${BOLDDESK_API_KEY ? '✅ מוגדר' : '❌ לא מוגדר'}
                    </span>
                    <span class="status ${HUDU_API_KEY ? 'active' : 'inactive'}">
                        Hudu API: ${HUDU_API_KEY ? '✅ מוגדר' : '❌ לא מוגדר'}
                    </span>
                </div>
                
                <div class="links">
                    <a href="/api/dashboard">📊 Dashboard</a>
                    <a href="/api/test">🔧 Test Page</a>
                    <a href="/health">❤️ Health Check</a>
                </div>
                
                <div class="info">
                    <strong>Webhook URL for BoldDesk:</strong><br>
                    <code>https://bolddesk-hudu-middleware-2026.vercel.app/bolddesk-webhook</code><br><br>
                    
                    <strong>What this integration does:</strong><br>
                    1. Receives ticket webhooks from BoldDesk<br>
                    2. Searches for customer in Hudu<br>
                    3. Updates BoldDesk ticket with Hudu info<br>
                    4. Adds internal note with customer details
                </div>
            </div>
        </body>
        </html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
        return;
    }
    
    // 404 for unknown routes
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${path} not found`,
        availableRoutes: [
            'GET /',
            'GET /health',
            'POST /bolddesk-webhook',
            'GET /api/dashboard',
            'GET /api/test'
        ]
    });
};
