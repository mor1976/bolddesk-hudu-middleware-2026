// api/index.js - Final working version for BoldDesk Custom App
const axios = require('axios');

// Environment variables
const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    // Handle POST requests from BoldDesk
    if (req.method === 'POST') {
        try {
            console.log('POST body:', JSON.stringify(req.body, null, 2));
            
            // Extract email from the payload
            let email = null;
            if (req.body) {
                // Try different possible paths for email
                email = req.body.requester?.EmailId ||
                       req.body.requester?.email ||
                       req.body.customer?.EmailId ||
                       req.body.customer?.email ||
                       req.body.EmailId ||
                       req.body.email ||
                       null;
            }
            
            console.log('Email found:', email);
            
            let htmlMessage = '';
            
            // If we have an email and Hudu credentials
            if (email && HUDU_API_KEY && HUDU_BASE_URL) {
                try {
                    // Search in Hudu
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
                        console.log('Found in Hudu:', asset.name);
                        
                        // Create HTML message for BoldDesk
                        htmlMessage = `
                            <div style='border: 1px solid #28a745; border-radius: 8px; padding: 15px; background: #f8fff9;'>
                                <h4 style='color: #28a745; margin: 0 0 10px 0;'>✅ Customer Found in Hudu</h4>
                                <div style='color: #333; line-height: 1.6;'>
                                    <p style='margin: 5px 0;'><strong>Name:</strong> ${asset.name}</p>
                                    <p style='margin: 5px 0;'><strong>Company:</strong> ${asset.company_name}</p>
                                    <p style='margin: 5px 0;'><strong>Email:</strong> ${email}</p>
                                    <p style='margin: 5px 0;'><strong>Asset ID:</strong> #${asset.id}</p>
                                    <a href='${asset.url}' target='_blank' style='display: inline-block; margin-top: 10px; padding: 8px 15px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;'>
                                        View in Hudu →
                                    </a>
                                </div>
                            </div>
                        `;
                    } else {
                        htmlMessage = `
                            <div style='border: 1px solid #ffc107; border-radius: 8px; padding: 15px; background: #fffef5;'>
                                <h4 style='color: #ff9800; margin: 0 0 10px 0;'>⚠️ Customer Not Found</h4>
                                <p style='color: #666;'>Email: ${email}</p>
                                <p style='color: #666; font-size: 12px;'>This customer needs to be added to Hudu.</p>
                            </div>
                        `;
                    }
                } catch (huduError) {
                    console.error('Hudu API error:', huduError.message);
                    htmlMessage = `
                        <div style='border: 1px solid #dc3545; border-radius: 8px; padding: 15px; background: #fff5f5;'>
                            <h4 style='color: #dc3545; margin: 0 0 10px 0;'>❌ Hudu Connection Error</h4>
                            <p style='color: #666; font-size: 12px;'>${huduError.message}</p>
                        </div>
                    `;
                }
            } else if (!email) {
                htmlMessage = `
                    <div style='border: 1px solid #6c757d; border-radius: 8px; padding: 15px; background: #f8f9fa;'>
                        <h4 style='color: #6c757d; margin: 0 0 10px 0;'>ℹ️ No Email Found</h4>
                        <p style='color: #666; font-size: 12px;'>Could not extract email from ticket data.</p>
                    </div>
                `;
            } else {
                htmlMessage = `
                    <div style='border: 1px solid #6c757d; border-radius: 8px; padding: 15px; background: #f8f9fa;'>
                        <h4 style='color: #6c757d; margin: 0 0 10px 0;'>ℹ️ Hudu Not Configured</h4>
                        <p style='color: #666; font-size: 12px;'>Please configure Hudu API credentials.</p>
                    </div>
                `;
            }
            
            // Return response in BoldDesk format
            const response = {
                "message": htmlMessage,
                "statusCode": "200"
            };
            
            console.log('Sending response to BoldDesk');
            res.status(200).json(response);
            
        } catch (error) {
            console.error('Error:', error);
            
            // Error response
            const errorResponse = {
                "message": `<div style='color: red;'>Error: ${error.message}</div>`,
                "statusCode": "500"
            };
            
            res.status(200).json(errorResponse);
        }
    } 
    // Handle GET requests (for testing)
    else if (req.method === 'GET') {
        // Test response
        const testResponse = {
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>The webhook is ready to receive data from BoldDesk.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    // Handle other methods
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
