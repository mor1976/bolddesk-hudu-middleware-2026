// api/index.js - Show only customer-specific assets
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
                    // Search for ALL assets related to this email/customer
                    const assetsResponse = await axios.get(
                        `${HUDU_BASE_URL}/api/v1/assets`,
                        {
                            headers: {
                                'x-api-key': HUDU_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            params: { 
                                search: email,
                                page_size: 100
                            }
                        }
                    );
                    
                    // Filter to get only customer-related assets
                    const allAssets = assetsResponse.data?.assets || [];
                    
                    // Find the main customer asset (type: People)
                    const customerAsset = allAssets.find(asset => 
                        asset.asset_type?.toLowerCase().includes('people') ||
                        asset.asset_type?.toLowerCase().includes('person') ||
                        asset.asset_type?.toLowerCase().includes('contact')
                    ) || allAssets[0];
                    
                    if (!customerAsset) {
                        htmlMessage = `
                            <div style='border: 1px solid #ffc107; border-radius: 8px; padding: 15px; background: #fffef5;'>
                                <h4 style='color: #ff9800; margin: 0 0 10px 0;'>⚠️ Customer Not Found</h4>
                                <p style='color: #666;'>Email: ${email}</p>
                            </div>
                        `;
                    } else {
                        console.log('Found customer:', customerAsset.name);
                        
                        // Search for assets that contain the customer's name or email
                        let customerRelatedAssets = [];
                        
                        // Try to get assets that mention this customer
                        try {
                            // Search by customer name
                            const nameSearchResponse = await axios.get(
                                `${HUDU_BASE_URL}/api/v1/assets`,
                                {
                                    headers: {
                                        'x-api-key': HUDU_API_KEY,
                                        'Content-Type': 'application/json'
                                    },
                                    params: { 
                                        search: customerAsset.name,
                                        page_size: 50
                                    }
                                }
                            );
                            customerRelatedAssets = nameSearchResponse.data?.assets || [];
                            
                            // Filter out the customer asset itself and keep only related items
                            customerRelatedAssets = customerRelatedAssets.filter(asset => 
                                asset.id !== customerAsset.id
                            );
                            
                            console.log(`Found ${customerRelatedAssets.length} related assets`);
                        } catch (e) {
                            console.log('Could not fetch related assets:', e.message);
                        }
                        
                        // Extract customer fields
                        const getFieldValue = (asset, fieldName) => {
                            const field = asset.fields?.find(f => 
                                f.label?.toLowerCase().includes(fieldName.toLowerCase())
                            );
                            return field?.value || null;
                        };
                        
                        // Get customer details
                        const customerPhone = getFieldValue(customerAsset, 'phone') || 
                                            getFieldValue(customerAsset, 'טלפון') ||
                                            getFieldValue(customerAsset, 'cell') ||
                                            getFieldValue(customerAsset, 'mobile');
                        
                        const customerAddress = getFieldValue(customerAsset, 'address') || 
                                              getFieldValue(customerAsset, 'כתובת');
                        
                        const customerTitle = getFieldValue(customerAsset, 'title') || 
                                            getFieldValue(customerAsset, 'תפקיד') ||
                                            getFieldValue(customerAsset, 'position');
                        
                        // Group related assets by type
                        const groupedAssets = {};
                        customerRelatedAssets.forEach(asset => {
                            const type = asset.asset_type || 'Other';
                            if (!groupedAssets[type]) {
                                groupedAssets[type] = [];
                            }
                            groupedAssets[type].push(asset);
                        });
                        
                        // Create HTML
                        htmlMessage = `
                            <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                                <style>
                                    .info-grid {
                                        display: grid;
                                        grid-template-columns: 1fr 1fr;
                                        gap: 8px;
                                        margin: 10px 0;
                                    }
                                    .info-item {
                                        padding: 8px;
                                        background: #f6f8fa;
                                        border-radius: 4px;
                                    }
                                    .info-label {
                                        color: #586069;
                                        font-size: 11px;
                                        margin-bottom: 2px;
                                    }
                                    .info-value {
                                        color: #24292e;
                                        font-weight: 500;
                                        font-size: 13px;
                                    }
                                    .asset-item {
                                        background: #f6f8fa;
                                        border: 1px solid #e1e4e8;
                                        border-radius: 6px;
                                        margin: 8px 0;
                                        padding: 10px;
                                        transition: all 0.2s;
                                    }
                                    .asset-item:hover {
                                        border-color: #667eea;
                                        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
                                    }
                                    .asset-header {
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        cursor: pointer;
                                    }
                                    .asset-title {
                                        font-weight: 500;
                                        color: #24292e;
                                    }
                                    .asset-details {
                                        display: none;
                                        margin-top: 10px;
                                        padding-top: 10px;
                                        border-top: 1px solid #e1e4e8;
                                    }
                                    .asset-details.show {
                                        display: block;
                                    }
                                    .field-row {
                                        display: flex;
                                        padding: 4px 0;
                                        font-size: 12px;
                                    }
                                    .field-label {
                                        color: #586069;
                                        min-width: 100px;
                                    }
                                    .field-value {
                                        color: #24292e;
                                        flex: 1;
                                    }
                                </style>
                                
                                <!-- Header -->
                                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px;'>
                                    <div style='display: flex; justify-content: space-between; align-items: center;'>
                                        <div style='font-weight: 600; font-size: 14px;'>
                                            ✅ ${customerAsset.name}
                                        </div>
                                        <div style='background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 11px;'>
                                            ${customerAsset.company_name}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Customer Details -->
                                <div style='background: white; padding: 15px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 13px;'>👤 פרטי לקוח</h4>
                                    <div class='info-grid'>
                                        <div class='info-item'>
                                            <div class='info-label'>אימייל</div>
                                            <div class='info-value'>${email}</div>
                                        </div>
                                        ${customerPhone ? `
                                        <div class='info-item'>
                                            <div class='info-label'>טלפון</div>
                                            <div class='info-value'>${customerPhone}</div>
                                        </div>
                                        ` : ''}
                                        ${customerTitle ? `
                                        <div class='info-item'>
                                            <div class='info-label'>תפקיד</div>
                                            <div class='info-value'>${customerTitle}</div>
                                        </div>
                                        ` : ''}
                                        ${customerAddress ? `
                                        <div class='info-item'>
                                            <div class='info-label'>כתובת</div>
                                            <div class='info-value'>${customerAddress}</div>
                                        </div>
                                        ` : ''}
                                        <div class='info-item'>
                                            <div class='info-label'>Asset ID</div>
                                            <div class='info-value'>#${customerAsset.id}</div>
                                        </div>
                                        <div class='info-item'>
                                            <div class='info-label'>עודכן</div>
                                            <div class='info-value'>${new Date(customerAsset.updated_at).toLocaleDateString('he-IL')}</div>
                                        </div>
                                    </div>
                                    
                                    <!-- Show all customer fields -->
                                    ${customerAsset.fields && customerAsset.fields.length > 0 ? `
                                        <div style='margin-top: 15px; padding-top: 15px; border-top: 1px solid #e1e4e8;'>
                                            <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 13px;'>📋 שדות נוספים</h4>
                                            ${customerAsset.fields.filter(f => f.value).map(field => `
                                                <div class='field-row'>
                                                    <span class='field-label'>${field.label}:</span>
                                                    <span class='field-value'>${field.value}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <!-- Related Assets (if any) -->
                                ${customerRelatedAssets.length > 0 ? `
                                <div style='background: white; padding: 15px; border: 1px solid #e1e4e8;'>
                                    <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 13px;'>
                                        🔗 נכסים קשורים (${customerRelatedAssets.length})
                                    </h4>
                                    ${Object.entries(groupedAssets).map(([type, assets]) => {
                                        let icon = '📄';
                                        if (type.toLowerCase().includes('computer')) icon = '💻';
                                        else if (type.toLowerCase().includes('password')) icon = '🔐';
                                        else if (type.toLowerCase().includes('license')) icon = '🔑';
                                        
                                        return `
                                        <div style='margin: 10px 0;'>
                                            <div style='font-weight: 500; color: #586069; font-size: 12px; margin-bottom: 5px;'>
                                                ${icon} ${type} (${assets.length})
                                            </div>
                                            ${assets.map(asset => `
                                                <div class='asset-item'>
                                                    <div class='asset-header' onclick='toggleAsset(this)'>
                                                        <span class='asset-title'>${asset.name}</span>
                                                        <span style='color: #586069; font-size: 11px;'>▼</span>
                                                    </div>
                                                    <div class='asset-details'>
                                                        ${asset.primary_serial ? `
                                                        <div class='field-row'>
                                                            <span class='field-label'>Serial:</span>
                                                            <span class='field-value'>${asset.primary_serial}</span>
                                                        </div>
                                                        ` : ''}
                                                        <div style='margin-top: 8px;'>
                                                            <a href='${asset.url}' target='_blank' style='color: #0969da; text-decoration: none; font-size: 11px;'>
                                                                View in Hudu →
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                        `;
                                    }).join('')}
                                </div>
                                ` : ''}
                                
                                <!-- Footer -->
                                <div style='background: #f6f8fa; padding: 12px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center;'>
                                    <a href='${customerAsset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px;'>
                                        🔍 View Full Details in Hudu
                                    </a>
                                </div>
                                
                                <script>
                                    function toggleAsset(header) {
                                        const details = header.nextElementSibling;
                                        if (details.classList.contains('show')) {
                                            details.classList.remove('show');
                                        } else {
                                            details.classList.add('show');
                                        }
                                    }
                                </script>
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
            } else {
                htmlMessage = `
                    <div style='border: 1px solid #6c757d; border-radius: 8px; padding: 15px; background: #f8f9fa;'>
                        <h4 style='color: #6c757d; margin: 0 0 10px 0;'>ℹ️ Configuration Issue</h4>
                        <p style='color: #666; font-size: 12px;'>Email or Hudu credentials not found.</p>
                    </div>
                `;
            }
            
            // Return response in BoldDesk format
            const response = {
                "message": htmlMessage,
                "statusCode": "200"
            };
            
            console.log('Sending customer-specific response to BoldDesk');
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
    // Handle GET requests
    else if (req.method === 'GET') {
        const testResponse = {
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Customer-specific assets version.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
