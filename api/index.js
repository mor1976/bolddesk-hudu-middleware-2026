// api/index.js - Complete Fixed Version
const axios = require('axios');

// Load environment variables
const BOLDDESK_API_KEY = process.env.BOLDDESK_API_KEY;
const BOLDDESK_BASE_URL = process.env.BOLDDESK_BASE_URL || 'https://morget-morco.bolddesk.com';
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

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
    
    // Get the path from the URL
    const path = req.url ? req.url.split('?')[0] : '/';
    
    // Main webhook endpoint for BoldDesk Custom App
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
            
            // Find customer email
            function findEmail(obj) {
                if (!obj) return null;
                
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
                    } else {
                        console.log('No assets found in Hudu for this email');
                    }
                    
                } catch (huduError) {
                    console.error('Hudu error:', huduError.message);
                }
            }
            
            // Return HTML for BoldDesk Custom App
            if (huduAsset) {
                const htmlResponse = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            padding: 10px;
            margin: 0;
            background: transparent;
        }
        .hudu-container {
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .hudu-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-weight: bold;
            font-size: 14px;
            text-align: center;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
            font-size: 13px;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: 600;
            color: #495057;
        }
        .info-value {
            color: #212529;
            text-align: right;
        }
        .hudu-link {
            display: block;
            margin-top: 15px;
            padding: 10px;
            background: #28a745;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            text-align: center;
            font-weight: 500;
            font-size: 13px;
        }
        .hudu-link:hover {
            background: #218838;
        }
        .verified-badge {
            display: inline-block;
            background: #d4edda;
            color: #155724;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="hudu-container">
        <div class="hudu-header">
            🔗 Hudu Customer Info
            <span class="verified-badge">✓ Verified</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">👤 Name:</span>
            <span class="info-value">${huduAsset.name}</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">🏢 Company:</span>
            <span class="info-value">${huduAsset.company_name}</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">🆔 Asset ID:</span>
            <span class="info-value">#${huduAsset.id}</span>
        </div>
        
        <div class="info-row">
            <span class="info-label">📧 Email:</span>
            <span class="info-value">${customerEmail}</span>
        </div>
        
        <a href="${huduAsset.url}" target="_blank" class="hudu-link">
            View in Hudu →
        </a>
    </div>
</body>
</html>`;
                
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.status(200).send(htmlResponse);
                
            } else {
                // Customer not found HTML
                const notFoundHTML = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 10px;
            margin: 0;
            background: transparent;
        }
        .not-found {
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ffeaa7;
            text-align: center;
        }
        .not-found h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
        }
        .not-found p {
            margin: 5px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="not-found">
        <h4>⚠️ Customer Not Found in Hudu</h4>
        <p>Email: <strong>${customerEmail || 'No email provided'}</strong></p>
        <p>Add this customer to Hudu to see their information here.</p>
    </div>
</body>
</html>`;
                
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.status(200).send(notFoundHTML);
            }
            
        } catch (error) {
            console.error('Webhook error:', error);
            
            const errorHTML = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial; padding: 10px; margin: 0; }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 12px; 
            border-radius: 6px;
            border: 1px solid #f5c6cb;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="error">
        <strong>❌ Error:</strong> ${error.message}
    </div>
</body>
</html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(errorHTML);
        }
        return;
    }
    
    // Health check endpoint
    if (path === '/health' && req.method === 'GET') {
        let bolddeskStatus = 'Not configured';
        let huduStatus = 'Not configured';
        
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
    
    // Root endpoint - Home page
    if (path === '/' && req.method === 'GET') {
        const html = `<!DOCTYPE html>
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
        h1 { color: #333; margin-bottom: 10px; }
        .status {
            display: inline-block;
            padding: 8px 16px;
            margin: 10px 5px;
            border-radius: 20px;
            font-size: 14px;
        }
        .status.active { background: #d4edda; color: #155724; }
        .status.inactive { background: #f8d7da; color: #721c24; }
        .links { margin-top: 30px; }
        a {
            display: inline-block;
            margin: 10px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
        }
        a:hover { opacity: 0.9; }
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
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 BoldDesk-Hudu Integration</h1>
        <p>Custom App Service is Running!</p>
        
        <div>
            <span class="status ${BOLDDESK_API_KEY ? 'active' : 'inactive'}">
                BoldDesk: ${BOLDDESK_API_KEY ? '✅ Connected' : '❌ Not Connected'}
            </span>
            <span class="status ${HUDU_API_KEY ? 'active' : 'inactive'}">
                Hudu: ${HUDU_API_KEY ? '✅ Connected' : '❌ Not Connected'}
            </span>
        </div>
        
        <div class="links">
            <a href="/api/test">🔧 Test Page</a>
            <a href="/health">❤️ Health Check</a>
        </div>
        
        <div class="info">
            <strong>Custom App URL for BoldDesk:</strong><br>
            <code>https://bolddesk-hudu-middleware-2026.vercel.app/bolddesk-webhook</code>
        </div>
    </div>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
        return;
    }
    
    // 404 for unknown routes
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${path} not found`
    });
};
