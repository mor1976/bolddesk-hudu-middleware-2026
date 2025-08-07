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

// Main endpoint for BoldDesk webhook
app.post('/bolddesk-webhook', async (req, res) => {
    try {
        console.log('Received request from BoldDesk');
        
        const testHTML = `
            <div style="padding: 20px; font-family: Arial, sans-serif;">
                <h2>🎉 החיבור עובד!</h2>
                <p>השרת קיבל את הבקשה מ-BoldDesk בהצלחה.</p>
                <p><strong>זמן:</strong> ${new Date().toLocaleString('he-IL')}</p>
            </div>
        `;
        
        res.json({ html: testHTML });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Test endpoint for development - מתוקן!
app.get('/test/:email', async (req, res) => {
    try {
        const email = req.params.email;
        console.log(`Testing with email: ${email}`);
        
        // בדיקה שיש API Keys
        if (!HUDU_API_KEY || !HUDU_BASE_URL) {
            return res.status(400).json({
                email: email,
                error: 'Missing Hudu API configuration',
                message: 'Hudu API Key או Base URL לא מוגדרים'
            });
        }
        
        // חיפוש חברות ב-Hudu
        const companiesResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies`, {
            headers: {
                'x-api-key': HUDU_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        const companies = companiesResponse.data.companies || [];
        console.log(`Found ${companies.length} companies`);
        
        let foundClient = null;
        let foundAssets = [];
        let searchResults = [];
        
        // חיפוש במס' מוגבל של חברות (למניעת timeout)
        const maxCompaniesToSearch = Math.min(companies.length, 10);
        
        for (let i = 0; i < maxCompaniesToSearch; i++) {
            const company = companies[i];
            try {
                const assetsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${company.id}/assets`, {
                    headers: {
                        'x-api-key': HUDU_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000 // 5 second timeout
                });
                
                const assets = assetsResponse.data.assets || [];
                searchResults.push(`${company.name}: ${assets.length} assets`);
                
                // חיפוש אנשים עם מייל תואם
                const matchingAssets = assets.filter(asset => {
                    if (asset.fields) {
                        // חיפוש בכל השדות
                        const fieldsStr = JSON.stringify(asset.fields).toLowerCase();
                        return fieldsStr.includes(email.toLowerCase());
                    }
                    return false;
                });
                
                if (matchingAssets.length > 0) {
                    foundClient = company;
                    foundAssets = assets;
                    console.log(`Found match in ${company.name}`);
                    break;
                }
                
            } catch (assetError) {
                searchResults.push(`${company.name}: Error - ${assetError.message}`);
                console.log(`Error with ${company.name}:`, assetError.message);
            }
        }
        
        res.json({
            email: email,
            status: 'success',
            client_found: foundClient ? foundClient.name : null,
            companies_searched: maxCompaniesToSearch,
            total_companies: companies.length,
            assets_in_found_company: foundAssets.length,
            search_results: searchResults.slice(0, 5), // First 5 results
            hudu_connected: true,
            message: foundClient ? `✅ נמצא לקוח: ${foundClient.name}` : `❌ לא נמצא לקוח עם מייל ${email}`
        });
        
    } catch (error) {
        console.error('Test error:', error.message);
        res.status(500).json({ 
            email: req.params.email,
            error: error.message,
            hudu_url: HUDU_BASE_URL,
            message: 'שגיאה בחיבור ל-Hudu'
        });
    }
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Webhook: http://localhost:${PORT}/bolddesk-webhook`);
        console.log(`❤️  Health: http://localhost:${PORT}/health`);
    });
}

// Export for Vercel
module.exports = app;
