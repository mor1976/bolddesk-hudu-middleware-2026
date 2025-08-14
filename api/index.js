// Simplified and fixed approach based on Hudu API documentation
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    if (req.method === 'POST') {
        try {
            // Extract email
            let email = req.body.requester?.EmailId ||
                       req.body.requester?.email ||
                       req.body.customer?.EmailId ||
                       req.body.customer?.email ||
                       req.body.EmailId ||
                       req.body.email ||
                       null;
            
            console.log('Email found:', email);
            
            if (email && HUDU_API_KEY && HUDU_BASE_URL) {
                try {
                    // 1. Find customer asset
                    const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                        headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                        params: { search: email, page_size: 25 }
                    });
                    
                    const allAssets = searchResponse.data?.assets || [];
                    const customerAsset = allAssets.find(asset => 
                        asset.asset_type?.toLowerCase().includes('people') ||
                        asset.asset_type?.toLowerCase().includes('person') ||
                        asset.asset_type?.toLowerCase().includes('contact') ||
                        asset.fields?.some(f => f.value?.includes(email))
                    );
                    
                    if (!customerAsset) {
                        const response = {
                            "message": `<div style='color: red; padding: 15px;'>לא נמצא לקוח עם המייל: ${email}</div>`,
                            "statusCode": "200"
                        };
                        res.status(200).json(response);
                        return;
                    }
                    
                    console.log('Found customer:', customerAsset.name, 'ID:', customerAsset.id);
                    
                    // 2. Get detailed customer info
                    let detailedCustomerAsset = customerAsset;
                    try {
                        const customerDetailResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`, {
                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' }
                        });
                        
                        if (customerDetailResponse.data?.asset) {
                            detailedCustomerAsset = customerDetailResponse.data.asset;
                            console.log('Got detailed customer asset');
                        }
                    } catch (detailError) {
                        console.log('Could not get detailed customer asset');
                    }
                    
                    // 3. Try Relations API first (simple approach)
                    let relatedAssets = [];
                    let searchMethod = 'Smart Match';
                    
                    try {
                        console.log('Trying Relations API...');
                        const relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                            params: {
                                page: 1,
                                page_size: 100
                            }
                        });
                        
                        const allRelations = relationsResponse.data?.relations || [];
                        console.log(`Relations API returned ${allRelations.length} total relations`);
                        
                        // Find relations involving our customer
                        const customerRelations = allRelations.filter(relation => 
                            (relation.fromable_type === 'Asset' && relation.fromable_id === customerAsset.id) ||
                            (relation.toable_type === 'Asset' && relation.toable_id === customerAsset.id)
                        );
                        
                        console.log(`Found ${customerRelations.length} relations for customer`);
                        
                        if (customerRelations.length > 0) {
                            searchMethod = 'Relations API';
                            
                            // Get details for each related asset
                            for (const relation of customerRelations) {
                                try {
                                    let relatedAssetId = null;
                                    
                                    // Determine the related asset ID
                                    if (relation.fromable_type === 'Asset' && relation.fromable_id === customerAsset.id) {
                                        if (relation.toable_type === 'Asset') {
                                            relatedAssetId = relation.toable_id;
                                        }
                                    } else if (relation.toable_type === 'Asset' && relation.toable_id === customerAsset.id) {
                                        if (relation.fromable_type === 'Asset') {
                                            relatedAssetId = relation.fromable_id;
                                        }
                                    }
                                    
                                    if (relatedAssetId) {
                                        const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedAssetId}`, {
                                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' }
                                        });
                                        
                                        if (assetResponse.data?.asset) {
                                            const relatedAsset = assetResponse.data.asset;
                                            relatedAsset.match_reason = relation.description || 'Relations API';
                                            relatedAsset.confidence = 'relations';
                                            relatedAssets.push(relatedAsset);
                                            console.log(`✓ Added via Relations API: ${relatedAsset.name}`);
                                        }
                                    }
                                } catch (assetError) {
                                    console.log('Error fetching related asset:', assetError.message);
                                }
                            }
                        }
                        
                    } catch (relationsError) {
                        console.log('Relations API failed:', relationsError.message);
                    }
                    
                    // 4. If no Relations found, use simple smart matching
                    if (relatedAssets.length === 0) {
                        console.log('No Relations found, using smart matching...');
                        
                        // Get company assets
                        const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                            params: { page_size: 100 }
                        });
                        
                        const companyAssets = companyResponse.data?.assets || [];
                        console.log(`Found ${companyAssets.length} assets in company`);
                        
                        const customerName = customerAsset.name.toLowerCase().trim();
                        const nameParts = customerName.split(/\s+/);
                        const firstName = nameParts[0];
                        const lastName = nameParts[nameParts.length - 1];
                        
                        // Simple matching logic
                        relatedAssets = companyAssets.filter(asset => {
                            if (asset.id === customerAsset.id) return false;
                            
                            const assetType = (asset.asset_type || '').toLowerCase();
                            if (assetType.includes('people') || assetType.includes('person') || assetType.includes('contact')) {
                                return false;
                            }
                            
                            const assetName = (asset.name || '').toLowerCase();
                            
                            // Name matching
                            if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                                asset.match_reason = `שם מכיל "${firstName}"`;
                                asset.confidence = 'high';
                                return true;
                            }
                            
                            if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                                asset.match_reason = `שם מכיל "${lastName}"`;
                                asset.confidence = 'high';
                                return true;
                            }
                            
                            // Field matching
                            if (asset.fields && asset.fields.length > 0) {
                                for (const field of asset.fields) {
                                    const fieldValue = (field.value || '').toString().toLowerCase();
                                    if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                        asset.match_reason = `שדה "${field.label}"`;
                                        asset.confidence = 'high';
                                        return true;
                                    }
                                    if (lastName && lastName.length > 2 && fieldValue.includes(lastName)) {
                                        asset.match_reason = `שדה "${field.label}"`;
                                        asset.confidence = 'high';
                                        return true;
                                    }
                                }
                            }
                            
                            // Small company logic
                            const userAssetTypes = ['computer', 'email', 'print', 'phone', 'license', 'mobile', 'laptop'];
                            const isUserAsset = userAssetTypes.some(type => assetType.includes(type));
                            
                            if (isUserAsset && companyAssets.length <= 15) {
                                asset.match_reason = 'נכס משתמש - חברה קטנה';
                                asset.confidence = 'medium';
                                return true;
                            }
                            
                            return false;
                        });
                        
                        console.log(`Smart matching found ${relatedAssets.length} assets`);
                    }
                    
                    // 5. Create HTML response
                    const htmlMessage = `
                        <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                            <style>
                                .header {
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                    padding: 12px 15px;
                                    border-radius: 8px 8px 0 0;
                                    margin: -10px -10px 0 -10px;
                                }
                                .customer-name {
                                    font-size: 16px;
                                    font-weight: 600;
                                    margin: 0;
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                }
                                .company-badge {
                                    background: rgba(255,255,255,0.2);
                                    padding: 4px 8px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                }
                                .content {
                                    padding: 15px;
                                    background: #f8f9fa;
                                    border-radius: 0 0 8px 8px;
                                    margin: 0 -10px -10px -10px;
                                }
                                .customer-info {
                                    background: white;
                                    border-radius: 8px;
                                    padding: 12px;
                                    margin-bottom: 15px;
                                    border: 1px solid #e2e8f0;
                                }
                                .info-grid {
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 8px;
                                    font-size: 12px;
                                }
                                .info-item {
                                    padding: 6px;
                                    background: #f8f9fa;
                                    border-radius: 4px;
                                }
                                .info-label {
                                    color: #64748b;
                                    font-size: 10px;
                                    font-weight: 600;
                                    margin-bottom: 2px;
                                }
                                .info-value {
                                    color: #1e293b;
                                    font-weight: 500;
                                    word-break: break-word;
                                }
                                .assets-section h3 {
                                    font-size: 14px;
                                    color: #1e293b;
                                    margin: 0 0 10px 0;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                }
                                .method-badge {
                                    background: ${searchMethod === 'Relations API' ? '#10b981' : '#8b5cf6'};
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 8px;
                                    font-weight: 600;
                                }
                                .asset-item {
                                    background: white;
                                    border-radius: 6px;
                                    margin: 8px 0;
                                    border: 1px solid #e2e8f0;
                                    overflow: hidden;
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                                }
                                .asset-header {
                                    padding: 10px 12px;
                                    background: #f8f9fa;
                                    cursor: pointer;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    border-bottom: 1px solid #e2e8f0;
                                }
                                .asset-header:hover {
                                    background: #f1f5f9;
                                }
                                .asset-title {
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    flex: 1;
                                }
                                .asset-icon {
                                    font-size: 16px;
                                }
                                .asset-name {
                                    font-size: 13px;
                                    font-weight: 500;
                                    color: #1e293b;
                                }
                                .asset-type {
                                    background: #3b82f6;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 10px;
                                    font-size: 9px;
                                    font-weight: 600;
                                }
                                .confidence-relations {
                                    background: #10b981;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 9px;
                                    font-weight: 500;
                                }
                                .confidence-high {
                                    background: #10b981;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 9px;
                                    font-weight: 500;
                                }
                                .confidence-medium {
                                    background: #f59e0b;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 9px;
                                    font-weight: 500;
                                }
                                .asset-details {
                                    display: none;
                                    padding: 12px;
                                    background: #fafbfc;
                                }
                                .asset-details.show {
                                    display: block;
                                }
                                .detail-grid {
                                    display: grid;
                                    grid-template-columns: 1fr 1fr;
                                    gap: 8px;
                                    font-size: 11px;
                                }
                                .detail-item {
                                    padding: 6px;
                                    background: white;
                                    border-radius: 4px;
                                    border: 1px solid #e2e8f0;
                                }
                                .detail-label {
                                    color: #64748b;
                                    font-size: 9px;
                                    font-weight: 600;
                                    margin-bottom: 2px;
                                }
                                .detail-value {
                                    color: #1e293b;
                                    font-weight: 500;
                                    word-break: break-word;
                                }
                                .hudu-link {
                                    display: inline-block;
                                    background: #667eea;
                                    color: white;
                                    text-decoration: none;
                                    padding: 6px 10px;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    font-weight: 600;
                                    margin-top: 8px;
                                }
                                .no-assets {
                                    text-align: center;
                                    padding: 20px;
                                    color: #64748b;
                                    background: white;
                                    border-radius: 6px;
                                    border: 1px dashed #cbd5e1;
                                }
                                .expand-icon {
                                    font-size: 12px;
                                    color: #64748b;
                                    transition: transform 0.2s;
                                }
                            </style>
                            
                            <!-- Header -->
                            <div class='header'>
                                <div class='customer-name'>
                                    <span>👤 ${detailedCustomerAsset.name}</span>
                                    <span class='company-badge'>${detailedCustomerAsset.company_name}</span>
                                </div>
                            </div>
                            
                            <div class='content'>
                                <!-- Customer Info -->
                                <div class='customer-info'>
                                    <div class='info-grid'>
                                        ${detailedCustomerAsset.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 4).map(field => `
                                            <div class='info-item'>
                                                <div class='info-label'>${field.label || 'Field'}</div>
                                                <div class='info-value'>${field.value || 'N/A'}</div>
                                            </div>
                                        `).join('') || '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-size: 12px;">אין מידע נוסף</div>'}
                                    </div>
                                </div>
                                
                                <!-- Related Assets -->
                                <div class='assets-section'>
                                    <h3>
                                        🔗 נכסים קשורים (${relatedAssets.length})
                                        <span class='method-badge'>${searchMethod}</span>
                                    </h3>
                                    
                                    ${relatedAssets.length > 0 ? relatedAssets.map(item => {
                                        let icon = '📄';
                                        const type = item.asset_type || 'Other';
                                        if (type.toLowerCase().includes('phone')) icon = '📱';
                                        else if (type.toLowerCase().includes('computer')) icon = '💻';
                                        else if (type.toLowerCase().includes('laptop')) icon = '💻';
                                        else if (type.toLowerCase().includes('password')) icon = '🔐';
                                        else if (type.toLowerCase().includes('license')) icon = '🔑';
                                        else if (type.toLowerCase().includes('printer')) icon = '🖨️';
                                        else if (type.toLowerCase().includes('print')) icon = '🖨️';
                                        else if (type.toLowerCase().includes('network')) icon = '🔌';
                                        else if (type.toLowerCase().includes('email')) icon = '📧';
                                        else if (type.toLowerCase().includes('sharepoint')) icon = '📊';
                                        else if (type.toLowerCase().includes('switch')) icon = '🔌';
                                        
                                        return `
                                            <div class='asset-item'>
                                                <div class='asset-header' onclick='toggleDetails(this)'>
                                                    <div class='asset-title'>
                                                        <span class='asset-icon'>${icon}</span>
                                                        <div>
                                                            <div class='asset-name'>${item.name || 'Unnamed Asset'}</div>
                                                            <div style='display: flex; gap: 4px; margin-top: 2px;'>
                                                                <span class='asset-type'>${type}</span>
                                                                <span class='confidence-${item.confidence || 'medium'}'>${item.match_reason}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span class='expand-icon'>▼</span>
                                                </div>
                                                <div class='asset-details'>
                                                    <div class='detail-grid'>
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Asset ID</div>
                                                            <div class='detail-value'>${item.id || 'N/A'}</div>
                                                        </div>
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Asset Type</div>
                                                            <div class='detail-value'>${item.asset_type || 'N/A'}</div>
                                                        </div>
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Match Method</div>
                                                            <div class='detail-value'>${searchMethod}</div>
                                                        </div>
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Match Confidence</div>
                                                            <div class='detail-value'>${item.confidence || 'medium'}</div>
                                                        </div>
                                                        ${item.primary_serial ? `
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Serial Number</div>
                                                            <div class='detail-value'>${item.primary_serial}</div>
                                                        </div>
                                                        ` : ''}
                                                        ${item.primary_mail ? `
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Email</div>
                                                            <div class='detail-value'>${item.primary_mail}</div>
                                                        </div>
                                                        ` : ''}
                                                        ${item.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 4).map(field => `
                                                            <div class='detail-item'>
                                                                <div class='detail-label'>${field.label || 'Field'}</div>
                                                                <div class='detail-value'>${field.value}</div>
                                                            </div>
                                                        `).join('') || ''}
                                                    </div>
                                                    <a href='${item.url || '#'}' target='_blank' class='hudu-link'>
                                                        🔗 פתח ב-Hudu
                                                    </a>
                                                </div>
                                            </div>
                                        `;
                                    }).join('') : `
                                        <div class='no-assets'>
                                            <div style='font-size: 24px; margin-bottom: 8px;'>🔍</div>
                                            <div style='font-size: 14px; font-weight: 600; margin-bottom: 4px;'>לא נמצאו נכסים קשורים</div>
                                            <div style='font-size: 12px;'>לא נמצאו נכסים המקושרים ל-${detailedCustomerAsset.name}</div>
                                        </div>
                                    `}
                                </div>
                                
                                <!-- Footer -->
                                <div style='text-align: center; margin-top: 15px;'>
                                    <a href='${detailedCustomerAsset.url}' target='_blank' class='hudu-link'>
                                        👤 פתח פרופיל לקוח
                                    </a>
                                </div>
                            </div>
                            
                            <script>
                                function toggleDetails(header) {
                                    const details = header.nextElementSibling;
                                    const arrow = header.querySelector('.expand-icon');
                                    
                                    if (details.classList.contains('show')) {
                                        details.classList.remove('show');
                                        arrow.style.transform = 'rotate(0deg)';
                                        arrow.textContent = '▼';
                                    } else {
                                        details.classList.add('show');
                                        arrow.style.transform = 'rotate(180deg)';
                                        arrow.textContent = '▲';
                                    }
                                }
                            </script>
                        </div>
                    `;
                    
                    const response = {
                        "message": htmlMessage,
                        "statusCode": "200"
                    };
                    
                    res.status(200).json(response);
                    
                } catch (huduError) {
                    console.error('Hudu API error:', huduError.message);
                    const response = {
                        "message": `<div style='color: red; padding: 15px;'>שגיאה ב-Hudu API: ${huduError.message}</div>`,
                        "statusCode": "500"
                    };
                    res.status(200).json(response);
                }
            } else {
                const response = {
                    "message": `<div style='color: orange; padding: 15px;'>חסרים נתונים: Email=${!!email}, API_KEY=${!!HUDU_API_KEY}, BASE_URL=${!!HUDU_BASE_URL}</div>`,
                    "statusCode": "200"
                };
                res.status(200).json(response);
            }
            
        } catch (error) {
            console.error('Error:', error);
            const response = {
                "message": `<div style='color: red; padding: 15px;'>שגיאה כללית: ${error.message}</div>`,
                "statusCode": "500"
            };
            res.status(200).json(response);
        }
    } 
    else if (req.method === 'GET') {
        const testResponse = {
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Simplified Relations + Smart Match version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
