// api/index.js - Show customer with their related items from Hudu
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
                    // 1. Search for the customer (People asset)
                    const searchResponse = await axios.get(
                        `${HUDU_BASE_URL}/api/v1/assets`,
                        {
                            headers: {
                                'x-api-key': HUDU_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            params: { 
                                search: email,
                                page_size: 25
                            }
                        }
                    );
                    
                    // Find the People/Contact asset
                    const allAssets = searchResponse.data?.assets || [];
                    const customerAsset = allAssets.find(asset => 
                        asset.asset_type?.toLowerCase().includes('people') ||
                        asset.asset_type?.toLowerCase().includes('person') ||
                        asset.asset_type?.toLowerCase().includes('contact') ||
                        asset.name?.includes(email.split('@')[0])
                    );
                    
                    if (!customerAsset) {
                        htmlMessage = `
                            <div style='border: 1px solid #ffc107; border-radius: 8px; padding: 15px; background: #fffef5;'>
                                <h4 style='color: #ff9800; margin: 0 0 10px 0;'>⚠️ Customer Not Found</h4>
                                <p style='color: #666;'>Email: ${email}</p>
                            </div>
                        `;
                    } else {
                        console.log('Found customer:', customerAsset.name, 'ID:', customerAsset.id);
                        
                        // 2. Get the specific asset details with relations
                        let fullAssetDetails = null;
                        let relatedItems = [];
                        
                        try {
                            // Get full asset details including relations
                            const assetDetailResponse = await axios.get(
                                `${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`,
                                {
                                    headers: {
                                        'x-api-key': HUDU_API_KEY,
                                        'Content-Type': 'application/json'
                                    }
                                }
                            );
                            fullAssetDetails = assetDetailResponse.data?.asset;
                            console.log('Got full asset details');
                            
                            // Get related items through relations endpoint if available
                            try {
                                const relationsResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/relations`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        },
                                        params: {
                                            fromable_type: 'Asset',
                                            fromable_id: customerAsset.id
                                        }
                                    }
                                );
                                
                                const relations = relationsResponse.data?.relations || [];
                                console.log(`Found ${relations.length} relations`);
                                
                                // Get details for each related asset
                                for (const relation of relations) {
                                    if (relation.toable_type === 'Asset' && relation.toable_id) {
                                        try {
                                            const relatedAssetResponse = await axios.get(
                                                `${HUDU_BASE_URL}/api/v1/assets/${relation.toable_id}`,
                                                {
                                                    headers: {
                                                        'x-api-key': HUDU_API_KEY,
                                                        'Content-Type': 'application/json'
                                                    }
                                                }
                                            );
                                            if (relatedAssetResponse.data?.asset) {
                                                relatedItems.push(relatedAssetResponse.data.asset);
                                            }
                                        } catch (e) {
                                            console.log(`Could not fetch related asset ${relation.toable_id}`);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log('Could not fetch relations:', e.message);
                            }
                            
                            // Alternative: Search for Phone assets with matching customer name
                            if (relatedItems.length === 0) {
                                const phoneSearchResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        },
                                        params: {
                                            asset_layout_id: null,
                                            page_size: 100
                                        }
                                    }
                                );
                                
                                const companyAssets = phoneSearchResponse.data?.assets || [];
                                
                                // Find assets that might be related to this customer
                                relatedItems = companyAssets.filter(asset => {
                                    // Check if asset name contains customer name
                                    if (asset.name?.toLowerCase().includes(customerAsset.name.toLowerCase())) {
                                        return true;
                                    }
                                    // Check if any field contains customer name or ID
                                    if (asset.fields) {
                                        return asset.fields.some(field => 
                                            field.value?.toString().toLowerCase().includes(customerAsset.name.toLowerCase()) ||
                                            field.value?.toString().includes(customerAsset.id.toString())
                                        );
                                    }
                                    return false;
                                });
                                
                                console.log(`Found ${relatedItems.length} potentially related items`);
                            }
                            
                        } catch (e) {
                            console.log('Could not fetch asset details:', e.message);
                        }
                        
                        // Extract customer fields
                        const getFieldValue = (asset, fieldName) => {
                            const field = asset.fields?.find(f => 
                                f.label?.toLowerCase().includes(fieldName.toLowerCase())
                            );
                            return field?.value || null;
                        };
                        
                        // Group related items by type
                        const groupedRelated = {};
                        relatedItems.forEach(item => {
                            const type = item.asset_type || 'Other';
                            if (!groupedRelated[type]) {
                                groupedRelated[type] = [];
                            }
                            groupedRelated[type].push(item);
                        });
                        
                        // Create HTML
                        htmlMessage = `
                            <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                                <style>
                                    .detail-section {
                                        margin: 15px 0;
                                        padding: 12px;
                                        background: #f6f8fa;
                                        border-radius: 6px;
                                    }
                                    .field-grid {
                                        display: grid;
                                        grid-template-columns: 1fr 1fr;
                                        gap: 10px;
                                        margin: 10px 0;
                                    }
                                    .field-item {
                                        padding: 8px;
                                        background: white;
                                        border-radius: 4px;
                                        border: 1px solid #e1e4e8;
                                    }
                                    .field-label {
                                        color: #586069;
                                        font-size: 11px;
                                        margin-bottom: 2px;
                                    }
                                    .field-value {
                                        color: #24292e;
                                        font-weight: 500;
                                        font-size: 13px;
                                    }
                                    .related-item {
                                        background: white;
                                        border: 1px solid #e1e4e8;
                                        border-radius: 6px;
                                        margin: 8px 0;
                                        overflow: hidden;
                                    }
                                    .related-header {
                                        background: #f6f8fa;
                                        padding: 10px 12px;
                                        border-bottom: 1px solid #e1e4e8;
                                        cursor: pointer;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                    }
                                    .related-header:hover {
                                        background: #f0f2f5;
                                    }
                                    .related-title {
                                        font-weight: 500;
                                        color: #24292e;
                                        display: flex;
                                        align-items: center;
                                        gap: 8px;
                                    }
                                    .related-type {
                                        background: #e3f2fd;
                                        color: #0969da;
                                        padding: 2px 6px;
                                        border-radius: 3px;
                                        font-size: 10px;
                                        font-weight: 600;
                                    }
                                    .related-details {
                                        display: none;
                                        padding: 12px;
                                    }
                                    .related-details.show {
                                        display: block;
                                    }
                                    .detail-row {
                                        display: flex;
                                        padding: 5px 0;
                                        font-size: 12px;
                                    }
                                    .detail-label {
                                        color: #586069;
                                        min-width: 100px;
                                    }
                                    .detail-value {
                                        color: #24292e;
                                        flex: 1;
                                        word-break: break-word;
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
                                <div class='detail-section'>
                                    <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 14px;'>👤 פרטי לקוח</h4>
                                    <div class='field-grid'>
                                        ${customerAsset.fields?.filter(f => f.value).slice(0, 8).map(field => `
                                            <div class='field-item'>
                                                <div class='field-label'>${field.label}</div>
                                                <div class='field-value'>${field.value}</div>
                                            </div>
                                        `).join('') || '<div>No fields available</div>'}
                                    </div>
                                </div>
                                
                                <!-- Related Items -->
                                ${relatedItems.length > 0 ? `
                                <div class='detail-section'>
                                    <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 14px;'>
                                        🔗 פריטים מקושרים (${relatedItems.length})
                                    </h4>
                                    ${Object.entries(groupedRelated).map(([type, items]) => {
                                        let icon = '📄';
                                        if (type.toLowerCase().includes('phone')) icon = '📱';
                                        else if (type.toLowerCase().includes('computer')) icon = '💻';
                                        else if (type.toLowerCase().includes('password')) icon = '🔐';
                                        else if (type.toLowerCase().includes('license')) icon = '🔑';
                                        
                                        return items.map(item => `
                                            <div class='related-item'>
                                                <div class='related-header' onclick='toggleRelated(this)'>
                                                    <div class='related-title'>
                                                        <span>${icon}</span>
                                                        <span>${item.name}</span>
                                                        <span class='related-type'>${type}</span>
                                                    </div>
                                                    <span style='color: #586069; font-size: 12px;'>▼</span>
                                                </div>
                                                <div class='related-details'>
                                                    ${item.fields?.filter(f => f.value).map(field => `
                                                        <div class='detail-row'>
                                                            <span class='detail-label'>${field.label}:</span>
                                                            <span class='detail-value'>${field.value}</span>
                                                        </div>
                                                    `).join('') || ''}
                                                    ${item.primary_serial ? `
                                                        <div class='detail-row'>
                                                            <span class='detail-label'>Serial:</span>
                                                            <span class='detail-value'>${item.primary_serial}</span>
                                                        </div>
                                                    ` : ''}
                                                    ${item.primary_model ? `
                                                        <div class='detail-row'>
                                                            <span class='detail-label'>Model:</span>
                                                            <span class='detail-value'>${item.primary_model}</span>
                                                        </div>
                                                    ` : ''}
                                                    <div style='margin-top: 10px; padding-top: 10px; border-top: 1px solid #e1e4e8;'>
                                                        <a href='${item.url}' target='_blank' style='color: #0969da; text-decoration: none; font-size: 11px;'>
                                                            🔗 View in Hudu →
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('');
                                    }).join('')}
                                </div>
                                ` : `
                                <div class='detail-section'>
                                    <p style='color: #586069; font-size: 12px; text-align: center; margin: 0;'>
                                        אין פריטים מקושרים ללקוח זה
                                    </p>
                                </div>
                                `}
                                
                                <!-- Footer -->
                                <div style='background: #f6f8fa; padding: 12px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center;'>
                                    <a href='${customerAsset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px;'>
                                        🔍 View Full Details in Hudu
                                    </a>
                                </div>
                                
                                <script>
                                    function toggleRelated(header) {
                                        const details = header.nextElementSibling;
                                        const arrow = header.querySelector('span:last-child');
                                        
                                        if (details.classList.contains('show')) {
                                            details.classList.remove('show');
                                            arrow.style.transform = 'rotate(0deg)';
                                        } else {
                                            // Close all other open items
                                            document.querySelectorAll('.related-details.show').forEach(d => {
                                                d.classList.remove('show');
                                            });
                                            document.querySelectorAll('.related-header span:last-child').forEach(a => {
                                                a.style.transform = 'rotate(0deg)';
                                            });
                                            
                                            // Open this item
                                            details.classList.add('show');
                                            arrow.style.transform = 'rotate(180deg)';
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
            
            console.log('Sending response with related items to BoldDesk');
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Related items version.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
