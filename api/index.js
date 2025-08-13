// Compact and smart search for related assets
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
                    
                    console.log(`Found ${allCompanyAssets.length} total assets in company`);
                    
                    // 3. Much more aggressive matching for related assets
                    const customerName = customerAsset.name.toLowerCase().trim();
                    const nameParts = customerName.split(/\s+/);
                    const firstName = nameParts[0];
                    const lastName = nameParts[nameParts.length - 1];
                    
                    const relatedAssets = allCompanyAssets.filter(asset => {
                        if (asset.id === customerAsset.id) return false;
                        
                        const assetName = (asset.name || '').toLowerCase();
                        const assetType = (asset.asset_type || '').toLowerCase();
                        
                        console.log(`Checking: ${asset.name} (${asset.asset_type})`);
                        
                        // Method 1: Direct name match
                        if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                            console.log(`✓ Name match (first): ${asset.name}`);
                            asset.match_reason = `מכיל "${firstName}"`;
                            return true;
                        }
                        
                        if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                            console.log(`✓ Name match (last): ${asset.name}`);
                            asset.match_reason = `מכיל "${lastName}"`;
                            return true;
                        }
                        
                        // Method 2: Field matching
                        if (asset.fields && asset.fields.length > 0) {
                            for (const field of asset.fields) {
                                const fieldValue = (field.value || '').toString().toLowerCase();
                                const fieldLabel = (field.label || '').toLowerCase();
                                
                                if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                    console.log(`✓ Field match: ${asset.name} in ${field.label}`);
                                    asset.match_reason = `שדה: ${field.label}`;
                                    return true;
                                }
                                
                                if (lastName && lastName.length > 2 && fieldValue.includes(lastName)) {
                                    console.log(`✓ Field match: ${asset.name} in ${field.label}`);
                                    asset.match_reason = `שדה: ${field.label}`;
                                    return true;
                                }
                                
                                // Ownership fields
                                if ((fieldLabel.includes('user') || fieldLabel.includes('owner') || 
                                     fieldLabel.includes('assigned') || fieldLabel.includes('name') ||
                                     fieldLabel.includes('שם') || fieldLabel.includes('בעלים') ||
                                     fieldLabel.includes('משתמש')) &&
                                    (fieldValue.includes(firstName) || (lastName && fieldValue.includes(lastName)))) {
                                    console.log(`✓ Owner field: ${asset.name}`);
                                    asset.match_reason = `בעלות: ${field.label}`;
                                    return true;
                                }
                            }
                        }
                        
                        // Method 3: Small company - assume user assets belong to customer
                        const userAssetTypes = ['computer', 'email', 'print', 'phone', 'license', 'device', 'mobile', 'laptop'];
                        const isUserAsset = userAssetTypes.some(type => assetType.includes(type));
                        
                        if (isUserAsset) {
                            // Count non-people assets in company
                            const nonPeopleAssets = allCompanyAssets.filter(a => 
                                !a.asset_type?.toLowerCase().includes('people') &&
                                !a.asset_type?.toLowerCase().includes('person') &&
                                !a.asset_type?.toLowerCase().includes('contact')
                            );
                            
                            // If small company (<=10 non-people assets), assume it belongs to customer
                            if (nonPeopleAssets.length <= 10) {
                                console.log(`✓ Small company user asset: ${asset.name}`);
                                asset.match_reason = 'חברה קטנה - נכס משתמש';
                                return true;
                            }
                        }
                        
                        // Method 4: Assets that are commonly single-user per company
                        const singleUserTypes = ['email', 'computer', 'laptop'];
                        if (singleUserTypes.some(type => assetType.includes(type))) {
                            // If there's only one of this type, it's probably the customer's
                            const sameTypeAssets = allCompanyAssets.filter(a => 
                                a.asset_type?.toLowerCase() === asset.asset_type?.toLowerCase() &&
                                a.id !== customerAsset.id
                            );
                            
                            if (sameTypeAssets.length === 1) {
                                console.log(`✓ Only one of type: ${asset.name}`);
                                asset.match_reason = 'נכס יחיד מסוגו';
                                return true;
                            }
                        }
                        
                        console.log(`✗ No match: ${asset.name}`);
                        return false;
                    });
                    
                    console.log(`Found ${relatedAssets.length} related assets:`, relatedAssets.map(a => a.name));
                    
                    // 4. Create compact HTML
                    const htmlMessage = `
                        <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px; max-width: 100%;'>
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
                                .match-reason {
                                    background: #10b981;
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
                            
                            <!-- Compact Header -->
                            <div class='header'>
                                <div class='customer-name'>
                                    <span>👤 ${customerAsset.name}</span>
                                    <span class='company-badge'>${customerAsset.company_name}</span>
                                </div>
                            </div>
                            
                            <div class='content'>
                                <!-- Compact Customer Info -->
                                <div class='customer-info'>
                                    <div class='info-grid'>
                                        ${customerAsset.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 4).map(field => `
                                            <div class='info-item'>
                                                <div class='info-label'>${field.label || 'Field'}</div>
                                                <div class='info-value'>${field.value || 'N/A'}</div>
                                            </div>
                                        `).join('') || '<div style="grid-column: 1 / -1; text-align: center; color: #64748b; font-size: 12px;">אין מידע נוסף</div>'}
                                    </div>
                                </div>
                                
                                <!-- Assets Section -->
                                <div class='assets-section'>
                                    <h3>🔗 נכסים קשורים (${relatedAssets.length})</h3>
                                    
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
                                                                <span class='match-reason'>${item.match_reason}</span>
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
                                                        ${item.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 6).map(field => `
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
                                            <div style='font-size: 12px;'>לא נמצאו נכסים קשורים ל-${customerAsset.name}</div>
                                        </div>
                                    `}
                                </div>
                                
                                <!-- Footer -->
                                <div style='text-align: center; margin-top: 15px;'>
                                    <a href='${customerAsset.url}' target='_blank' class='hudu-link'>
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Compact & Smart version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
