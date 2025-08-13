// Fall back to smart matching since Relations API isn't working as expected
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
                    
                    // 2. Try to get related assets using proper Relations API
                    let relatedAssets = [];
                    
                    try {
                        console.log('Attempting to fetch relations for customer asset ID:', customerAsset.id);
                        
                        // First try: GET /relations (List All Relations)
                        let relationsResponse;
                        try {
                            console.log('Trying GET /relations...');
                            relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                                headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' }
                            });
                            console.log('GET /relations successful, got', relationsResponse.data?.relations?.length || 0, 'total relations');
                            
                            // Filter relations that involve our customer asset
                            const allRelations = relationsResponse.data?.relations || [];
                            const customerRelations = allRelations.filter(relation => 
                                (relation.fromable_type === 'Asset' && relation.fromable_id === customerAsset.id) ||
                                (relation.toable_type === 'Asset' && relation.toable_id === customerAsset.id)
                            );
                            
                            console.log('Found', customerRelations.length, 'relations involving customer asset');
                            
                            // Process each relation to get the related asset details
                            for (const relation of customerRelations) {
                                try {
                                    console.log('Processing relation:', JSON.stringify(relation, null, 2));
                                    
                                    let relatedAssetId = null;
                                    let relationType = 'Related';
                                    
                                    // Determine which asset is the related one (not the customer)
                                    if (relation.fromable_type === 'Asset' && relation.fromable_id === customerAsset.id) {
                                        // Customer is the 'from', so get the 'to' asset
                                        if (relation.toable_type === 'Asset') {
                                            relatedAssetId = relation.toable_id;
                                            relationType = relation.description || 'קשור אל';
                                        }
                                    } else if (relation.toable_type === 'Asset' && relation.toable_id === customerAsset.id) {
                                        // Customer is the 'to', so get the 'from' asset
                                        if (relation.fromable_type === 'Asset') {
                                            relatedAssetId = relation.fromable_id;
                                            relationType = relation.description || 'קשור מ';
                                        }
                                    }
                                    
                                    if (relatedAssetId) {
                                        console.log(`Fetching details for related asset ID: ${relatedAssetId}`);
                                        
                                        // Get the full asset details
                                        const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedAssetId}`, {
                                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' }
                                        });
                                        
                                        if (assetResponse.data?.asset) {
                                            const relatedAsset = assetResponse.data.asset;
                                            relatedAsset.relation_type = relationType;
                                            relatedAsset.relation_id = relation.id;
                                            relatedAsset.match_reason = `Relations API: ${relationType}`;
                                            relatedAsset.confidence = 'relations';
                                            relatedAssets.push(relatedAsset);
                                            console.log(`✓ Added related asset via Relations API: ${relatedAsset.name} (${relatedAsset.asset_type}) - ${relationType}`);
                                        }
                                    }
                                    
                                } catch (assetError) {
                                    console.error('Error fetching related asset details:', assetError.message);
                                }
                            }
                            
                        } catch (getRelationsError) {
                            console.log('GET /relations failed:', getRelationsError.message);
                        }
                        
                        console.log(`Relations API found ${relatedAssets.length} related assets`);
                        
                    } catch (relationsError) {
                        console.error('Relations API completely failed:', relationsError.message);
                    }
                    
                    // 3. If Relations API didn't find anything, fall back to smart matching
                    if (relatedAssets.length === 0) {
                        console.log('Relations API found no assets, falling back to smart matching...');
                        
                        // Get ALL assets in the same company with improved filtering
                        let allCompanyAssets = [];
                        let page = 1;
                        let hasMorePages = true;
                        
                        while (hasMorePages && page <= 10) {
                            const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                                headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                                params: { page: page, page_size: 100 }
                            });
                            
                            const pageAssets = companyResponse.data?.assets || [];
                            allCompanyAssets = allCompanyAssets.concat(pageAssets);
                            hasMorePages = pageAssets.length === 100;
                            page++;
                        }
                        
                        console.log(`Found ${allCompanyAssets.length} total assets in company for smart matching`);
                        
                        // Smart matching logic (simplified version)
                        const customerName = customerAsset.name.toLowerCase().trim();
                        const nameParts = customerName.split(/\s+/);
                        const firstName = nameParts[0];
                        const lastName = nameParts[nameParts.length - 1];
                        
                        // Filter out people/contact assets first
                        const nonPeopleAssets = allCompanyAssets.filter(asset => {
                            const assetType = (asset.asset_type || '').toLowerCase();
                            return asset.id !== customerAsset.id && 
                                   !assetType.includes('people') && 
                                   !assetType.includes('person') && 
                                   !assetType.includes('contact');
                        });
                        
                        console.log(`Found ${nonPeopleAssets.length} non-people assets to check`);
                        
                        relatedAssets = nonPeopleAssets.filter(asset => {
                            const assetName = (asset.name || '').toLowerCase();
                            const assetType = (asset.asset_type || '').toLowerCase();
                            
                            // Method 1: Direct name match (highest priority)
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
                            
                            // Method 2: Field matching (high priority)
                            if (asset.fields && asset.fields.length > 0) {
                                for (const field of asset.fields) {
                                    const fieldValue = (field.value || '').toString().toLowerCase();
                                    const fieldLabel = (field.label || '').toLowerCase();
                                    
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
                            
                            // Method 3: Small company logic (medium priority)
                            const userAssetTypes = ['computer', 'email', 'print', 'phone', 'license', 'mobile', 'laptop', 'device'];
                            const isUserAsset = userAssetTypes.some(type => assetType.includes(type));
                            
                            if (isUserAsset && nonPeopleAssets.length <= 15) {
                                asset.match_reason = 'נכס משתמש - חברה קטנה';
                                asset.confidence = 'medium';
                                return true;
                            }
                            
                            return false;
                        });
                        
                        console.log(`Smart matching found ${relatedAssets.length} related assets`);
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
                                .relations-api-badge {
                                    background: #10b981;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 8px;
                                    font-weight: 600;
                                }
                                .smart-badge {
                                    background: #8b5cf6;
                                    color: white;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-size: 8px;
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
                                        ${relatedAssets.length > 0 && relatedAssets[0].confidence === 'relations' ? 
                                            '<span class="relations-api-badge">Relations API</span>' : 
                                            '<span class="smart-badge">Smart Match</span>'}
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
                                                            <div class='detail-label'>Match Confidence</div>
                                                            <div class='detail-value'>${item.confidence || 'medium'}</div>
                                                        </div>
                                                        <div class='detail-item'>
                                                            <div class='detail-label'>Match Reason</div>
                                                            <div class='detail-value'>${item.match_reason}</div>
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
                                            <div style='font-size: 24px; margin-bottom: 8px;'>🤖</div>
                                            <div style='font-size: 14px; font-weight: 600; margin-bottom: 4px;'>לא נמצאו נכסים מתאימים</div>
                                            <div style='font-size: 12px;'>חיפשנו ב-${nonPeopleAssets.length} נכסים אבל לא מצאנו קשרים חזקים ל-${detailedCustomerAsset.name}</div>
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Smart Match version (Relations API fallback). Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
