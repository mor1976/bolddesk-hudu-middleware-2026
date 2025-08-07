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