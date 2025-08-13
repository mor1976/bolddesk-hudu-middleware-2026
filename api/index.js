// api/index.js - Interactive version with expandable assets
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
                        const customerAsset = assetsResponse.data.assets[0];
                        console.log('Found customer:', customerAsset.name);
                        
                        // 2. Get all assets for this company
                        let companyAssets = [];
                        if (customerAsset.company_id) {
                            try {
                                const companyAssetsResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        },
                                        params: { 
                                            page_size: 50
                                        }
                                    }
                                );
                                companyAssets = companyAssetsResponse.data.assets || [];
                                console.log(`Found ${companyAssets.length} company assets`);
                            } catch (e) {
                                console.log('Could not fetch company assets:', e.message);
                            }
                        }
                        
                        // Group assets by type
                        const groupedAssets = {};
                        companyAssets.forEach(asset => {
                            const type = asset.asset_type || 'Other';
                            if (!groupedAssets[type]) {
                                groupedAssets[type] = [];
                            }
                            groupedAssets[type].push(asset);
                        });
                        
                        // Create enhanced HTML with JavaScript for interactivity
                        htmlMessage = `
                            <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                                <style>
                                    .asset-item {
                                        background: #f6f8fa;
                                        border: 1px solid #e1e4e8;
                                        border-radius: 6px;
                                        margin: 8px 0;
                                        transition: all 0.2s;
                                    }
                                    .asset-item:hover {
                                        border-color: #667eea;
                                        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
                                    }
                                    .asset-header {
                                        padding: 10px 12px;
                                        cursor: pointer;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        user-select: none;
                                    }
                                    .asset-title {
                                        font-weight: 500;
                                        color: #24292e;
                                        display: flex;
                                        align-items: center;
                                        gap: 8px;
                                    }
                                    .asset-toggle {
                                        color: #586069;
                                        font-size: 12px;
                                        transition: transform 0.2s;
                                    }
                                    .asset-details {
                                        display: none;
                                        padding: 0 12px 12px 12px;
                                        border-top: 1px solid #e1e4e8;
                                    }
                                    .asset-details.show {
                                        display: block;
                                    }
                                    .field-row {
                                        display: flex;
                                        padding: 6px 0;
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
                                    .asset-type-section {
                                        margin: 15px 0;
                                    }
                                    .section-title {
                                        font-weight: 600;
                                        color: #24292e;
                                        margin-bottom: 8px;
                                        padding: 8px;
                                        background: #f0f6fc;
                                        border-radius: 6px;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                    }
                                    .asset-count {
                                        background: #0969da;
                                        color: white;
                                        padding: 2px 8px;
                                        border-radius: 12px;
                                        font-size: 11px;
                                    }
                                    .expand-all {
                                        background: #667eea;
                                        color: white;
                                        border: none;
                                        padding: 6px 12px;
                                        border-radius: 4px;
                                        font-size: 11px;
                                        cursor: pointer;
                                        margin-left: 8px;
                                    }
                                    .expand-all:hover {
                                        background: #5a67d8;
                                    }
                                </style>
                                
                                <!-- Header -->
                                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px;'>
                                    <div style='display: flex; justify-content: space-between; align-items: center;'>
                                        <div style='font-weight: 600; font-size: 14px;'>✅ ${customerAsset.name}</div>
                                        <div style='background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; font-size: 11px;'>
                                            ${customerAsset.company_name}
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Quick Info -->
                                <div style='background: white; padding: 12px; border-left: 1px solid #e1e4e8; border-right: 1px solid #e1e4e8;'>
                                    <div style='display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center;'>
                                        <div>
                                            <div style='font-size: 20px; font-weight: 600; color: #0969da;'>${companyAssets.length}</div>
                                            <div style='font-size: 11px; color: #586069;'>סה"כ נכסים</div>
                                        </div>
                                        <div>
                                            <div style='font-size: 20px; font-weight: 600; color: #28a745;'>${Object.keys(groupedAssets).length}</div>
                                            <div style='font-size: 11px; color: #586069;'>סוגי נכסים</div>
                                        </div>
                                        <div>
                                            <div style='font-size: 20px; font-weight: 600; color: #764ba2;'>#${customerAsset.id}</div>
                                            <div style='font-size: 11px; color: #586069;'>Asset ID</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Assets List -->
                                <div style='background: white; padding: 15px; border: 1px solid #e1e4e8;'>
                                    <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;'>
                                        <h4 style='margin: 0; color: #24292e;'>🗂️ נכסי החברה</h4>
                                        <button class='expand-all' onclick='toggleAll()'>הצג/הסתר הכל</button>
                                    </div>
                                    
                                    ${Object.entries(groupedAssets).map(([type, assets]) => {
                                        // Get icon based on asset type
                                        let icon = '📄';
                                        if (type.toLowerCase().includes('computer')) icon = '💻';
                                        else if (type.toLowerCase().includes('license')) icon = '🔑';
                                        else if (type.toLowerCase().includes('phone')) icon = '📱';
                                        else if (type.toLowerCase().includes('password')) icon = '🔐';
                                        else if (type.toLowerCase().includes('website')) icon = '🌐';
                                        else if (type.toLowerCase().includes('network')) icon = '🔌';
                                        else if (type.toLowerCase().includes('printer')) icon = '🖨️';
                                        else if (type.toLowerCase().includes('people')) icon = '👤';
                                        
                                        return `
                                        <div class='asset-type-section'>
                                            <div class='section-title'>
                                                <span>${icon} ${type}</span>
                                                <span class='asset-count'>${assets.length}</span>
                                            </div>
                                            ${assets.map((asset, index) => `
                                                <div class='asset-item'>
                                                    <div class='asset-header' onclick='toggleAsset(this)'>
                                                        <div class='asset-title'>
                                                            <span>${asset.name || 'Unnamed Asset'}</span>
                                                        </div>
                                                        <span class='asset-toggle'>▼</span>
                                                    </div>
                                                    <div class='asset-details' id='asset-${asset.id}'>
                                                        ${asset.primary_serial ? `
                                                        <div class='field-row'>
                                                            <span class='field-label'>Serial:</span>
                                                            <span class='field-value'>${asset.primary_serial}</span>
                                                        </div>
                                                        ` : ''}
                                                        ${asset.primary_model ? `
                                                        <div class='field-row'>
                                                            <span class='field-label'>Model:</span>
                                                            <span class='field-value'>${asset.primary_model}</span>
                                                        </div>
                                                        ` : ''}
                                                        ${asset.primary_manufacturer ? `
                                                        <div class='field-row'>
                                                            <span class='field-label'>Manufacturer:</span>
                                                            <span class='field-value'>${asset.primary_manufacturer}</span>
                                                        </div>
                                                        ` : ''}
                                                        ${asset.fields && asset.fields.length > 0 ? 
                                                            asset.fields.slice(0, 5).map(field => {
                                                                if (field.value && field.label) {
                                                                    return `
                                                                    <div class='field-row'>
                                                                        <span class='field-label'>${field.label}:</span>
                                                                        <span class='field-value'>${field.value}</span>
                                                                    </div>
                                                                    `;
                                                                }
                                                                return '';
                                                            }).join('')
                                                        : ''}
                                                        <div class='field-row'>
                                                            <span class='field-label'>Updated:</span>
                                                            <span class='field-value'>${new Date(asset.updated_at).toLocaleDateString('he-IL')}</span>
                                                        </div>
                                                        <div style='margin-top: 10px; text-align: right;'>
                                                            <a href='${asset.url}' target='_blank' style='color: #0969da; text-decoration: none; font-size: 12px;'>
                                                                🔗 View in Hudu →
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            `).join('')}
                                        </div>
                                        `;
                                    }).join('')}
                                </div>
                                
                                <!-- Footer with actions -->
                                <div style='background: #f6f8fa; padding: 12px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center;'>
                                    <a href='${customerAsset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px; margin: 0 4px;'>
                                        👤 View Customer
                                    </a>
                                    <a href='${HUDU_BASE_URL}/companies/${customerAsset.company_id}' target='_blank' style='display: inline-block; padding: 8px 16px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px; margin: 0 4px;'>
                                        🏢 View Company
                                    </a>
                                </div>
                                
                                <script>
                                    function toggleAsset(header) {
                                        const details = header.nextElementSibling;
                                        const toggle = header.querySelector('.asset-toggle');
                                        
                                        if (details.classList.contains('show')) {
                                            details.classList.remove('show');
                                            toggle.style.transform = 'rotate(0deg)';
                                        } else {
                                            details.classList.add('show');
                                            toggle.style.transform = 'rotate(180deg)';
                                        }
                                    }
                                    
                                    function toggleAll() {
                                        const allDetails = document.querySelectorAll('.asset-details');
                                        const allToggles = document.querySelectorAll('.asset-toggle');
                                        const anyOpen = Array.from(allDetails).some(d => d.classList.contains('show'));
                                        
                                        allDetails.forEach((details, i) => {
                                            if (anyOpen) {
                                                details.classList.remove('show');
                                                allToggles[i].style.transform = 'rotate(0deg)';
                                            } else {
                                                details.classList.add('show');
                                                allToggles[i].style.transform = 'rotate(180deg)';
                                            }
                                        });
                                    }
                                </script>
                            </div>
                        `;
                    } else {
                        // Customer not found
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
            
            console.log('Sending interactive response to BoldDesk');
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Interactive version with expandable assets.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
