// Smart search for related assets with beautiful design
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
            
            if (email && HUDU_API_KEY && HUDU_BASE_URL) {
                try {
                    // 1. Find customer
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
                    
                    // 2. Get ALL assets in company
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
                    
                    // 3. Enhanced smart matching for related assets
                    const customerName = customerAsset.name.toLowerCase().trim();
                    const nameParts = customerName.split(/\s+/);
                    const firstName = nameParts[0];
                    const lastName = nameParts[nameParts.length - 1];
                    
                    const relatedAssets = allCompanyAssets.filter(asset => {
                        if (asset.id === customerAsset.id) return false;
                        
                        const assetName = (asset.name || '').toLowerCase();
                        const assetType = (asset.asset_type || '').toLowerCase();
                        
                        // Method 1: Direct name match
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
                        
                        // Method 2: Field matching
                        if (asset.fields && asset.fields.length > 0) {
                            for (const field of asset.fields) {
                                const fieldValue = (field.value || '').toString().toLowerCase();
                                const fieldLabel = (field.label || '').toLowerCase();
                                
                                if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                    asset.match_reason = `שדה "${field.label}" מכיל "${firstName}"`;
                                    asset.confidence = 'high';
                                    return true;
                                }
                                
                                if (lastName && lastName.length > 2 && fieldValue.includes(lastName)) {
                                    asset.match_reason = `שדה "${field.label}" מכיל "${lastName}"`;
                                    asset.confidence = 'high';
                                    return true;
                                }
                                
                                // Ownership fields
                                if ((fieldLabel.includes('user') || fieldLabel.includes('owner') || 
                                     fieldLabel.includes('assigned') || fieldLabel.includes('name') ||
                                     fieldLabel.includes('שם') || fieldLabel.includes('בעלים') ||
                                     fieldLabel.includes('משתמש')) &&
                                    (fieldValue.includes(firstName) || (lastName && fieldValue.includes(lastName)))) {
                                    asset.match_reason = `שדה בעלות: "${field.label}"`;
                                    asset.confidence = 'high';
                                    return true;
                                }
                            }
                        }
                        
                        // Method 3: Small company logic - if very few assets, likely belongs to customer
                        const nonPeopleAssets = allCompanyAssets.filter(a => 
                            !a.asset_type?.toLowerCase().includes('people') &&
                            !a.asset_type?.toLowerCase().includes('person') &&
                            !a.asset_type?.toLowerCase().includes('contact')
                        );
                        
                        if (nonPeopleAssets.length <= 8 && 
                            (assetType.includes('computer') || assetType.includes('email') || 
                             assetType.includes('print') || assetType.includes('phone') ||
                             assetType.includes('license') || assetType.includes('device'))) {
                            asset.match_reason = 'חברה קטנה - נכס של משתמש';
                            asset.confidence = 'medium';
                            return true;
                        }
                        
                        return false;
                    });
                    
                    // Sort by confidence (high confidence first)
                    relatedAssets.sort((a, b) => {
                        if (a.confidence === 'high' && b.confidence !== 'high') return -1;
                        if (b.confidence === 'high' && a.confidence !== 'high') return 1;
                        return 0;
                    });
                    
                    // 4. Create beautiful HTML
                    const htmlMessage = `
                        <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; margin: -10px;'>
                            <style>
                                .customer-header {
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                    padding: 20px;
                                    position: relative;
                                }
                                .customer-header::before {
                                    content: '';
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    bottom: 0;
                                    background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="30" r="1.5" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="70" r="1" fill="rgba(255,255,255,0.1)"/></svg>');
                                }
                                .customer-info {
                                    position: relative;
                                    z-index: 1;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                }
                                .customer-name {
                                    font-size: 18px;
                                    font-weight: 600;
                                    margin: 0;
                                    display: flex;
                                    align-items: center;
                                    gap: 10px;
                                }
                                .company-badge {
                                    background: rgba(255,255,255,0.2);
                                    padding: 6px 12px;
                                    border-radius: 20px;
                                    font-size: 12px;
                                    font-weight: 500;
                                    backdrop-filter: blur(10px);
                                }
                                .content-section {
                                    padding: 20px;
                                }
                                .customer-details {
                                    background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
                                    border-radius: 12px;
                                    padding: 20px;
                                    margin-bottom: 25px;
                                    border: 1px solid rgba(102, 126, 234, 0.1);
                                }
                                .section-title {
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: #2d3748;
                                    margin: 0 0 15px 0;
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                }
                                .field-grid {
                                    display: grid;
                                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                                    gap: 15px;
                                }
                                .field-card {
                                    background: white;
                                    padding: 15px;
                                    border-radius: 8px;
                                    border: 1px solid #e2e8f0;
                                    transition: all 0.2s ease;
                                }
                                .field-card:hover {
                                    transform: translateY(-2px);
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                }
                                .field-label {
                                    color: #64748b;
                                    font-size: 12px;
                                    font-weight: 500;
                                    margin-bottom: 5px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                }
                                .field-value {
                                    color: #1e293b;
                                    font-size: 14px;
                                    font-weight: 600;
                                    word-break: break-word;
                                }
                                .assets-section {
                                    background: linear-gradient(135deg, #fff8f0 0%, #fff4e6 100%);
                                    border-radius: 12px;
                                    padding: 20px;
                                    border: 1px solid rgba(251, 146, 60, 0.1);
                                }
                                .asset-card {
                                    background: white;
                                    border-radius: 12px;
                                    margin: 15px 0;
                                    overflow: hidden;
                                    border: 1px solid #e2e8f0;
                                    transition: all 0.3s ease;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                                }
                                .asset-card:hover {
                                    transform: translateY(-4px);
                                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                                }
                                .asset-header {
                                    padding: 18px;
                                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                                    cursor: pointer;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                    border-bottom: 1px solid #e2e8f0;
                                }
                                .asset-title-section {
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    flex: 1;
                                }
                                .asset-icon {
                                    font-size: 20px;
                                    padding: 8px;
                                    background: white;
                                    border-radius: 8px;
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                }
                                .asset-info {
                                    flex: 1;
                                }
                                .asset-name {
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: #1e293b;
                                    margin: 0 0 4px 0;
                                }
                                .asset-type-badge {
                                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                                    color: white;
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    font-size: 11px;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                }
                                .confidence-badge {
                                    padding: 4px 10px;
                                    border-radius: 16px;
                                    font-size: 10px;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                }
                                .confidence-high {
                                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                                    color: white;
                                }
                                .confidence-medium {
                                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                                    color: white;
                                }
                                .expand-arrow {
                                    font-size: 14px;
                                    color: #64748b;
                                    transition: transform 0.3s ease;
                                    padding: 8px;
                                }
                                .asset-details {
                                    padding: 0;
                                    max-height: 0;
                                    overflow: hidden;
                                    transition: all 0.4s ease;
                                    background: #fafbfc;
                                }
                                .asset-details.show {
                                    padding: 20px;
                                    max-height: 1000px;
                                }
                                .detail-grid {
                                    display: grid;
                                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                                    gap: 15px;
                                }
                                .detail-item {
                                    background: white;
                                    padding: 12px;
                                    border-radius: 8px;
                                    border: 1px solid #e2e8f0;
                                }
                                .detail-label {
                                    color: #64748b;
                                    font-size: 11px;
                                    font-weight: 600;
                                    margin-bottom: 4px;
                                    text-transform: uppercase;
                                }
                                .detail-value {
                                    color: #1e293b;
                                    font-size: 13px;
                                    font-weight: 500;
                                    word-break: break-word;
                                }
                                .hudu-link {
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 8px;
                                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    color: white;
                                    text-decoration: none;
                                    padding: 10px 16px;
                                    border-radius: 8px;
                                    font-size: 12px;
                                    font-weight: 600;
                                    transition: all 0.2s ease;
                                    margin-top: 15px;
                                }
                                .hudu-link:hover {
                                    transform: translateY(-2px);
                                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                                }
                                .no-assets {
                                    text-align: center;
                                    padding: 40px 20px;
                                    color: #64748b;
                                    background: white;
                                    border-radius: 12px;
                                    border: 2px dashed #e2e8f0;
                                }
                                .footer-section {
                                    text-align: center;
                                    padding: 20px;
                                    background: #f8fafc;
                                    border-top: 1px solid #e2e8f0;
                                }
                            </style>
                            
                            <!-- Customer Header -->
                            <div class='customer-header'>
                                <div class='customer-info'>
                                    <h1 class='customer-name'>
                                        <span>👤</span>
                                        ${customerAsset.name}
                                    </h1>
                                    <div class='company-badge'>
                                        ${customerAsset.company_name}
                                    </div>
                                </div>
                            </div>
                            
                            <div class='content-section'>
                                <!-- Customer Details -->
                                <div class='customer-details'>
                                    <h2 class='section-title'>
                                        <span>📋</span>
                                        פרטי הלקוח
                                    </h2>
                                    <div class='field-grid'>
                                        ${customerAsset.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 8).map(field => `
                                            <div class='field-card'>
                                                <div class='field-label'>${field.label || 'Field'}</div>
                                                <div class='field-value'>${field.value || 'N/A'}</div>
                                            </div>
                                        `).join('') || '<div style="grid-column: 1 / -1; text-align: center; color: #64748b;">אין שדות זמינים</div>'}
                                    </div>
                                </div>
                                
                                <!-- Related Assets -->
                                <div class='assets-section'>
                                    <h2 class='section-title'>
                                        <span>🔗</span>
                                        נכסים קשורים (${relatedAssets.length})
                                    </h2>
                                    
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
                                            <div class='asset-card'>
                                                <div class='asset-header' onclick='toggleAssetDetails(this)'>
                                                    <div class='asset-title-section'>
                                                        <div class='asset-icon'>${icon}</div>
                                                        <div class='asset-info'>
                                                            <div class='asset-name'>${item.name || 'Unnamed Asset'}</div>
                                                            <div style='display: flex; gap: 8px; align-items: center; margin-top: 4px;'>
                                                                <span class='asset-type-badge'>${type}</span>
                                                                <span class='confidence-badge confidence-${item.confidence || 'medium'}'>${item.match_reason}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class='expand-arrow'>▼</div>
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
                                                        ${item.fields && item.fields.length > 0 ? item.fields.filter(f => f.value && f.value.toString().trim()).map(field => `
                                                            <div class='detail-item'>
                                                                <div class='detail-label'>${field.label || 'Field'}</div>
                                                                <div class='detail-value'>${field.value}</div>
                                                            </div>
                                                        `).join('') : ''}
                                                    </div>
                                                    <a href='${item.url || '#'}' target='_blank' class='hudu-link'>
                                                        <span>🔗</span>
                                                        פתח ב-Hudu
                                                    </a>
                                                </div>
                                            </div>
                                        `;
                                    }).join('') : `
                                        <div class='no-assets'>
                                            <div style='font-size: 48px; margin-bottom: 16px;'>🔍</div>
                                            <h3 style='color: #475569; margin: 0 0 8px 0;'>לא נמצאו נכסים קשורים</h3>
                                            <p style='margin: 0; font-size: 14px;'>לא הצלחנו למצוא נכסים המקושרים ל-${customerAsset.name}</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                            
                            <!-- Footer -->
                            <div class='footer-section'>
                                <a href='${customerAsset.url}' target='_blank' class='hudu-link'>
                                    <span>👤</span>
                                    פתח פרופיל לקוח ב-Hudu
                                </a>
                            </div>
                            
                            <script>
                                function toggleAssetDetails(header) {
                                    const details = header.nextElementSibling;
                                    const arrow = header.querySelector('.expand-arrow');
                                    
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Smart & Beautiful version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
