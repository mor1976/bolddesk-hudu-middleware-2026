// api/check-bolddesk.js - בדיקת חיבור ל-BoldDesk API
const axios = require('axios');

module.exports = async (req, res) => {
    const BOLDDESK_API_KEY = process.env.BOLDDESK_API_KEY;
    const BOLDDESK_BASE_URL = process.env.BOLDDESK_BASE_URL || 'https://morget-morco.bolddesk.com';
    
    const results = {
        hasApiKey: !!BOLDDESK_API_KEY,
        baseUrl: BOLDDESK_BASE_URL,
        tests: {}
    };
    
    if (!BOLDDESK_API_KEY) {
        res.status(200).json({
            error: 'BoldDesk API key not configured',
            ...results
        });
        return;
    }
    
    // Test 1: Get tickets (בדיקה בסיסית)
    try {
        const ticketsResponse = await axios.get(
            `${BOLDDESK_BASE_URL}/api/v1/tickets?limit=1`,
            {
                headers: {
                    'x-api-key': BOLDDESK_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        results.tests.getTickets = '✅ Success';
    } catch (error) {
        results.tests.getTickets = `❌ Error: ${error.response?.status || error.message}`;
    }
    
    // Test 2: Get specific ticket (if ticket ID provided)
    const ticketId = req.query.ticketId || '65559';
    try {
        const ticketResponse = await axios.get(
            `${BOLDDESK_BASE_URL}/api/v1/tickets/${ticketId}`,
            {
                headers: {
                    'x-api-key': BOLDDESK_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        results.tests.getSpecificTicket = `✅ Ticket ${ticketId} found`;
        results.ticketInfo = {
            id: ticketResponse.data.id,
            subject: ticketResponse.data.subject,
            status: ticketResponse.data.status?.name
        };
    } catch (error) {
        results.tests.getSpecificTicket = `❌ Ticket ${ticketId} error: ${error.response?.status || error.message}`;
    }
    
    // Test 3: Try to add a test note
    if (req.query.testNote === 'true') {
        try {
            const noteResponse = await axios.post(
                `${BOLDDESK_BASE_URL}/api/v1/tickets/${ticketId}/notes`,
                {
                    content: `Test note from integration - ${new Date().toLocaleString()}`,
                    isPrivate: true
                },
                {
                    headers: {
                        'x-api-key': BOLDDESK_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            results.tests.addNote = '✅ Note added successfully';
            results.noteId = noteResponse.data.id;
        } catch (error) {
            results.tests.addNote = `❌ Add note error: ${error.response?.status || error.message}`;
            if (error.response?.data) {
                results.errorDetails = error.response.data;
            }
        }
    }
    
    // HTML response
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>BoldDesk API Check</title>
        <style>
            body { font-family: Arial; padding: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
            h1 { color: #333; }
            .test { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
            .info { background: #cfe2ff; color: #084298; }
            button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
            pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow: auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 BoldDesk API Connection Check</h1>
            
            <div class="test ${results.hasApiKey ? 'success' : 'error'}">
                <strong>API Key:</strong> ${results.hasApiKey ? '✅ Configured' : '❌ Not configured'}
            </div>
            
            <div class="test info">
                <strong>Base URL:</strong> ${results.baseUrl}
            </div>
            
            ${Object.entries(results.tests).map(([test, result]) => `
                <div class="test ${result.includes('✅') ? 'success' : 'error'}">
                    <strong>${test}:</strong> ${result}
                </div>
            `).join('')}
            
            <br>
            <button onclick="location.href='?ticketId=65559'">Test with Ticket 65559</button>
            <button onclick="location.href='?ticketId=99999'">Test with Ticket 99999</button>
            <button onclick="testAddNote()">Test Add Note</button>
            
            <br><br>
            <h3>Full Response:</h3>
            <pre>${JSON.stringify(results, null, 2)}</pre>
            
            <script>
                function testAddNote() {
                    const ticketId = prompt('Enter ticket ID to add test note:');
                    if (ticketId) {
                        location.href = '?ticketId=' + ticketId + '&testNote=true';
                    }
                }
            </script>
        </div>
    </body>
    </html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
};
