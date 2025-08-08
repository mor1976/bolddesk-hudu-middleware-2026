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

// Simple test endpoint
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
