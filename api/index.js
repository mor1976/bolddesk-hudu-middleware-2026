// api/index.js - Enhanced version with more Hudu details
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
                    // 1. Search for the customer asset
                    const assetsResponse = await axios.get(
                        `${HUDU_BASE_URL}/api/v1/assets`,
                        {
                            headers: {
                                'x-api-key': HUDU_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            params: { search: email }
                        }
                    );
                    
                    if (assetsResponse.data?.assets?.length > 0) {
                        const asset = assetsResponse.data.assets[0];
                        console.log('Found in Hudu:', asset.name);
                        
                        // 2. Get company details
                        let companyInfo = null;
                        if (asset.company_id) {
                            try {
                                const companyResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/companies/${asset.company_id}`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        }
                                    }
                                );
                                companyInfo = companyResponse.data.company;
                            } catch (e) {
                                console.log('Could not fetch company details');
                            }
                        }
                        
                        // 3. Get related assets (computers, passwords, etc.)
                        let relatedAssets = [];
                        if (asset.company_id) {
                            try {
                                const relatedResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/companies/${asset.company_id}/assets`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        },
                                        params: { 
                                            page_size: 10,
                                            asset_layout_id: null // Get all types
                                        }
                                    }
                                );
                                relatedAssets = relatedResponse.data.assets || [];
                            } catch (e) {
                                console.log('Could not fetch related assets');
                            }
                        }
                        
                        // Extract asset fields if they exist
                        const fields = asset.fields || [];
                        const getFieldValue = (fieldName) => {
                            const field = fields.find(f => 
                                f.label?.toLowerCase().includes(fieldName.toLowerCase())
                            );
                            return field?.value || '-';
                        };
                        
                        // Count asset types
                        const assetCounts = {
                            computers: relatedAssets.filter(a => a.asset_type?.toLowerCase().includes('computer')).length,
                            passwords: relatedAssets.filter(a => a.asset_type?.toLowerCase().includes('password')).length,
                            websites: relatedAssets.filter(a => a.asset_type?.toLowerCase().includes('website')).length,
                            total: relatedAssets.length
                        };
                        
                        // Create enhanced HTML message
                        htmlMessage = `
                            <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                                <!-- Header -->
                                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px;'>
                                    <div style='display: flex; justify-content: space-between; align-items: center;'>
                                        <div style='font-weight: 600; font-size: 14px;'>✅ Customer Found in Hudu</div>
                                        <div style='background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 11px;'>
                                            ID: #${asset.id}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Customer Info Section -->
                                <div style='background: white; padding: 15px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 10px;'>
                                        <div>
                                            <div style='color: #586069; font-size: 11px; margin-bottom: 2px;'>שם לקוח</div>
                                            <div style='color: #24292e; font-weight: 500;'>${asset.name}</div>
                                        </div>
                                        <div>
                                            <div style='color: #586069; font-size: 11px; margin-bottom: 2px;'>חברה</div>
                                            <div style='color: #24292e; font-weight: 500;'>${asset.company_name}</div>
                                        </div>
                                        <div>
                                            <div style='color: #586069; font-size: 11px; margin-bottom: 2px;'>אימייל</div>
                                            <div style='color: #0969da;'>${email}</div>
                                        </div>
                                        <div>
                                            <div style='color: #586069; font-size: 11px; margin-bottom: 2px;'>טלפון</div>
                                            <div style='color: #24292e;'>${getFieldValue('phone') || getFieldValue('טלפון')}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Company Details -->
                                ${companyInfo ? `
                                <div style='background: #f6f8fa; padding: 12px 15px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <div style='font-weight: 600; color: #24292e; margin-bottom: 8px; font-size: 12px;'>
                                        🏢 פרטי חברה
                                    </div>
                                    <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'>
                                        ${companyInfo.address ? `
                                        <div>
                                            <span style='color: #586069; font-size: 11px;'>כתובת:</span>
                                            <span style='color: #24292e; font-size: 12px;'>${companyInfo.address}</span>
                                        </div>
                                        ` : ''}
                                        ${companyInfo.phone_number ? `
                                        <div>
                                            <span style='color: #586069; font-size: 11px;'>טלפון:</span>
                                            <span style='color: #24292e; font-size: 12px;'>${companyInfo.phone_number}</span>
                                        </div>
                                        ` : ''}
                                        ${companyInfo.website ? `
                                        <div>
                                            <span style='color: #586069; font-size: 11px;'>אתר:</span>
                                            <a href='${companyInfo.website}' target='_blank' style='color: #0969da; font-size: 12px; text-decoration: none;'>
                                                ${companyInfo.website.replace('https://', '').replace('http://', '')}
                                            </a>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                                ` : ''}
                                
                                <!-- Assets Summary -->
                                <div style='background: white; padding: 12px 15px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <div style='font-weight: 600; color: #24292e; margin-bottom: 10px; font-size: 12px;'>
                                        📊 סיכום נכסים בחברה
                                    </div>
                                    <div style='display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;'>
                                        <div style='background: #f0f6fc; padding: 8px; border-radius: 6px;'>
                                            <div style='font-size: 18px; font-weight: 600; color: #0969da;'>${assetCounts.total}</div>
                                            <div style='font-size: 10px; color: #586069;'>סה"כ נכסים</div>
                                        </div>
                                        <div style='background: #f0fdf4; padding: 8px; border-radius: 6px;'>
                                            <div style='font-size: 18px; font-weight: 600; color: #16a34a;'>${assetCounts.computers}</div>
                                            <div style='font-size: 10px; color: #586069;'>מחשבים</div>
                                        </div>
                                        <div style='background: #fef3c7; padding: 8px; border-radius: 6px;'>
                                            <div style='font-size: 18px; font-weight: 600; color: #d97706;'>${assetCounts.passwords}</div>
                                            <div style='font-size: 10px; color: #586069;'>סיסמאות</div>
                                        </div>
                                        <div style='background: #fce7f3; padding: 8px; border-radius: 6px;'>
                                            <div style='font-size: 18px; font-weight: 600; color: #be185d;'>${assetCounts.websites}</div>
                                            <div style='font-size: 10px; color: #586069;'>אתרים</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Additional Fields -->
                                <div style='background: #f6f8fa; padding: 12px 15px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'>
                                        <div>
                                            <span style='color: #586069; font-size: 11px;'>סוג נכס:</span>
                                            <span style='color: #24292e; font-size: 12px; font-weight: 500;'>${asset.asset_type || 'People'}</span>
                                        </div>
                                        <div>
                                            <span style='color: #586069; font-size: 11px;'>עודכן לאחרונה:</span>
                                            <span style='color: #24292e; font-size: 12px;'>${new Date(asset.updated_at).toLocaleDateString('he-IL')}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Action Buttons -->
                                <div style='background: white; padding: 15px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center;'>
                                    <a href='${asset.url}' target='_blank' style='display: inline-block; padding: 8px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 13px; margin: 0 5px;'>
                                        🔍 View Full Details in Hudu
                                    </a>
                                    ${companyInfo ? `
                                    <a href='${HUDU_BASE_URL}/companies/${asset.company_id}' target='_blank' style='display: inline-block; padding: 8px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 13px; margin: 0 5px;'>
                                        🏢 View Company
                                    </a>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    } else {
                        // Customer not found
                        htmlMessage = `
                            <div style='border: 1px solid #ffc107; border-radius: 8px; padding: 15px; background: #fffef5;'>
                                <h4 style='color: #ff9800; margin: 0 0 10px 0;'>⚠️ Customer Not Found</h4>
                                <p style='color: #666;'>Email: ${email}</p>
                                <p style='color: #666; font-size: 12px;'>This customer needs to be added to Hudu.</p>
                                <a href='${HUDU_BASE_URL}/companies' target='_blank' style='display: inline-block; margin-top: 10px; padding: 8px 15px; background: #ff9800; color: white; text-decoration: none; border-radius: 5px;'>
                                    Add to Hudu →
                                </a>
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
            
            console.log('Sending enhanced response to BoldDesk');
            res.status(200).json(response);
            
        } catch (error) {
            console.error('Error:', error);
            
            const errorResponse = {
                "message": `<div style='color: red;'>Error: ${error.message}</div>`,
                "statusCode": "500"
            };
            
            res.status(200).json(errorResponse);
        }
    } 
    // Handle GET requests (for testing)
    else if (req.method === 'GET') {
        const testResponse = {
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Enhanced version with detailed customer information.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
