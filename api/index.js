// api/index.js - Search for assets containing customer name
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
                    // 1. Find the customer by email
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
                    
                    const allAssets = searchResponse.data?.assets || [];
                    const customerAsset = allAssets.find(asset => 
                        asset.asset_type?.toLowerCase().includes('people') ||
                        asset.asset_type?.toLowerCase().includes('person') ||
                        asset.asset_type?.toLowerCase().includes('contact') ||
                        asset.fields?.some(f => f.value?.includes(email))
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
                        console.log('Company ID:', customerAsset.company_id);
                        
                        let relatedAssets = [];
                        
                        // 2. Search for assets by customer name in the same company
                        if (customerAsset.name && customerAsset.company_id) {
                            try {
                                // Search for assets containing the customer's name
                                const nameSearchResponse = await axios.get(
                                    `${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`,
                                    {
                                        headers: {
                                            'x-api-key': HUDU_API_KEY,
                                            'Content-Type': 'application/json'
                                        },
                                        params: {
                                            page_size: 200 // Get more assets to search through
                                        }
                                    }
                                );
                                
                                const companyAssets = nameSearchResponse.data?.assets || [];
                                console.log(`Found ${companyAssets.length} assets in company`);
                                
                                // Filter assets that belong to this customer
                                // Look for customer name in asset name or fields
                                const customerName = customerAsset.name.toLowerCase();
                                const customerFirstName = customerName.split(' ')[0];
                                const customerLastName = customerName.split(' ').slice(-1)[0];
                                
                                relatedAssets = companyAssets.filter(asset => {
                                    // Skip the customer asset itself
                                    if (asset.id === customerAsset.id) return false;
                                    
                                    // Check if asset name contains customer name
                                    const assetName = asset.name?.toLowerCase() || '';
                                    if (assetName.includes(customerName) || 
                                        assetName.includes(customerFirstName) ||
                                        assetName.includes(customerLastName)) {
                                        console.log(`Found related by name: ${asset.name} (${asset.asset_type})`);
                                        return true;
                                    }
                                    
                                    // Check if any field contains customer name or refers to this person
                                    if (asset.fields && asset.fields.length > 0) {
                                        const hasCustomerReference = asset.fields.some(field => {
                                            const fieldValue = (field.value || '').toString().toLowerCase();
                                            // Check for customer name in fields
                                            if (fieldValue.includes(customerName) || 
                                                fieldValue.includes(customerFirstName) ||
                                                fieldValue.includes(customerLastName)) {
                                                return true;
                                            }
                                            // Check for fields labeled as "owner", "user", "assigned to", etc.
                                            const fieldLabel = (field.label || '').toLowerCase();
                                            if ((fieldLabel.includes('owner') || 
                                                 fieldLabel.includes('user') || 
                                                 fieldLabel.includes('assigned') ||
                                                 fieldLabel.includes('person') ||
                                                 fieldLabel.includes('contact')) &&
                                                fieldValue.includes(customerFirstName)) {
                                                return true;
                                            }
                                            return false;
                                        });
                                        
                                        if (hasCustomerReference) {
                                            console.log(`Found related by field: ${asset.name} (${asset.asset_type})`);
                                            return true;
                                        }
                                    }
                                    
                                    return false;
                                });
                                
                                console.log(`Filtered to ${relatedAssets.length} related assets`);
                                
                                // Also specifically look for Phone assets that might use a different naming
                                if (relatedAssets.length === 0) {
                                    // Try to find Phone assets with any reference to the customer
                                    const phoneAssets = companyAssets.filter(asset => 
                                        asset.asset_type?.toLowerCase().includes('phone') &&
                                        asset.id !== customerAsset.id
                                    );
                                    
                                    // Check if customer has a phone field that matches any phone asset
                                    const customerPhone = customerAsset.fields?.find(f => 
                                        f.label?.toLowerCase().includes('phone') || 
                                        f.label?.toLowerCase().includes('טלפון')
                                    )?.value;
                                    
                                    if (customerPhone) {
                                        relatedAssets = phoneAssets.filter(asset => {
                                            const phoneNumber = asset.fields?.find(f => 
                                                f.label?.toLowerCase().includes('number') ||
                                                f.label?.toLowerCase().includes('phone')
                                            )?.value;
                                            return phoneNumber === customerPhone;
                                        });
                                    }
                                }
                                
                            } catch (e) {
                                console.log('Error searching for related assets:', e.message);
                            }
                        }
                        
                        // Group related assets by type
                        const groupedRelated = {};
                        relatedAssets.forEach(item => {
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
                                        min-width: 120px;
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
                                
                                <!-- Related Assets -->
                                ${relatedAssets.length > 0 ? `
                                <div class='detail-section'>
                                    <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 14px;'>
                                        🔗 נכסים של ${customerAsset.name.split(' ')[0]} (${relatedAssets.length})
                                    </h4>
                                    ${Object.entries(groupedRelated).map(([type, items]) => {
                                        let icon = '📄';
                                        if (type.toLowerCase().includes('phone')) icon = '📱';
                                        else if (type.toLowerCase().includes('computer')) icon = '💻';
                                        else if (type.toLowerCase().includes('password')) icon = '🔐';
                                        else if (type.toLowerCase().includes('license')) icon = '🔑';
                                        else if (type.toLowerCase().includes('printer')) icon = '🖨️';
                                        else if (type.toLowerCase().includes('network')) icon = '🔌';
                                        
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
                                                    <div style='margin-top: 10px; padding-top: 10px; border-top: 1px solid #e1e4e8;'>
                                                        <a href='${item.url}' target='_blank' style='color: #0969da; text-decoration: none; font-size: 11px;'>
                                                            🔗 פתח ב-Hudu →
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('');
                                    }).join('')}
                                </div>
                                ` : `
                                <div class='detail-section' style='text-align: center;'>
                                    <p style='color: #586069; font-size: 12px; margin: 0;'>
                                        🔍 מחפש נכסים של ${customerAsset.name}...<br>
                                        <small>לא נמצאו נכסים המקושרים ללקוח זה</small>
                                    </p>
                                </div>
                                `}
                                
                                <!-- Debug Info -->
                                <div style='background: #fff5f5; padding: 8px; margin: 10px 0; border-radius: 4px; font-size: 11px; color: #666;'>
                                    <strong>Debug:</strong> Found ${relatedAssets.length} assets for "${customerAsset.name}" in company #${customerAsset.company_id}
                                </div>
                                
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
            
            console.log('Sending response to BoldDesk');
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Search by name version.</p></div>",
            "statusCode": "200"
        };
        
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
