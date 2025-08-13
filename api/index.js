// Enhanced search for related assets - finds by name, fields, and smart matching
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    if (req.method === 'POST') {
        try {
            console.log('POST body:', JSON.stringify(req.body, null, 2));
            
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
                    
                    console.log('Found customer:', customerAsset.name, 'ID:', customerAsset.id);
                    
                    // 2. Get ALL assets in company with multiple pages
                    let allCompanyAssets = [];
                    let page = 1;
                    let hasMorePages = true;
                    
                    while (hasMorePages && page <= 10) { // Limit to 10 pages
                        const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                            headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                            params: { page: page, page_size: 100 }
                        });
                        
                        const pageAssets = companyResponse.data?.assets || [];
                        allCompanyAssets = allCompanyAssets.concat(pageAssets);
                        
                        console.log(`Page ${page}: Found ${pageAssets.length} assets`);
                        hasMorePages = pageAssets.length === 100;
                        page++;
                    }
                    
                    console.log(`Total assets in company: ${allCompanyAssets.length}`);
                    
                    // 3. Smart asset matching
                    const customerName = customerAsset.name.toLowerCase().trim();
                    const nameParts = customerName.split(/\s+/);
                    const firstName = nameParts[0];
                    const lastName = nameParts[nameParts.length - 1];
                    
                    console.log('Customer name parts:', { customerName, firstName, lastName });
                    
                    // Enhanced search logic
                    const relatedAssets = allCompanyAssets.filter(asset => {
                        // Skip the customer asset itself
                        if (asset.id === customerAsset.id) {
                            return false;
                        }
                        
                        const assetName = (asset.name || '').toLowerCase();
                        const assetType = (asset.asset_type || '').toLowerCase();
                        
                        console.log(`\nChecking: "${asset.name}" (${asset.asset_type})`);
                        
                        // Method 1: Direct name match
                        if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                            console.log(`✓ Name match (first): ${asset.name}`);
                            asset.match_reason = `שם מכיל "${firstName}"`;
                            return true;
                        }
                        
                        if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                            console.log(`✓ Name match (last): ${asset.name}`);
                            asset.match_reason = `שם מכיל "${lastName}"`;
                            return true;
                        }
                        
                        // Method 2: Check all fields for customer name references
                        if (asset.fields && asset.fields.length > 0) {
                            for (const field of asset.fields) {
                                const fieldValue = (field.value || '').toString().toLowerCase();
                                const fieldLabel = (field.label || '').toLowerCase();
                                
                                // Check if field contains customer name
                                if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                    console.log(`✓ Field match (${field.label}): ${asset.name}`);
                                    asset.match_reason = `שדה "${field.label}" מכיל "${firstName}"`;
                                    return true;
                                }
                                
                                if (lastName && lastName.length > 2 && fieldValue.includes(lastName)) {
                                    console.log(`✓ Field match (${field.label}): ${asset.name}`);
                                    asset.match_reason = `שדה "${field.label}" מכיל "${lastName}"`;
                                    return true;
                                }
                                
                                // Check for ownership/assignment fields
                                if ((fieldLabel.includes('user') || 
                                     fieldLabel.includes('owner') || 
                                     fieldLabel.includes('assigned') ||
                                     fieldLabel.includes('person') ||
                                     fieldLabel.includes('contact') ||
                                     fieldLabel.includes('name') ||
                                     fieldLabel.includes('שם') ||
                                     fieldLabel.includes('בעלים') ||
                                     fieldLabel.includes('משתמש')) &&
                                    (fieldValue.includes(firstName) || 
                                     (lastName && fieldValue.includes(lastName)))) {
                                    console.log(`✓ Owner field match: ${asset.name}`);
                                    asset.match_reason = `שדה בעלות: "${field.label}"`;
                                    return true;
                                }
                            }
                        }
                        
                        // Method 3: Smart matching for user-related assets
                        if (assetType.includes('computer') || 
                            assetType.includes('email') || 
                            assetType.includes('print') ||
                            assetType.includes('phone') ||
                            assetType.includes('license') ||
                            assetType.includes('device')) {
                            
                            // For companies with few assets, assume single-user setup
                            if (allCompanyAssets.length <= 5) {
                                console.log(`✓ Small company assumption: ${asset.name}`);
                                asset.match_reason = 'חברה קטנה - כנראה שייך ללקוח';
                                return true;
                            }
                            
                            // Check for location-based matching
                            const customerLocation = customerAsset.fields?.find(f => 
                                f.label?.toLowerCase().includes('location') ||
                                f.label?.toLowerCase().includes('מיקום') ||
                                f.label?.toLowerCase().includes('אזור')
                            )?.value?.toLowerCase();
                            
                            if (customerLocation) {
                                if (assetName.includes(customerLocation) ||
                                    asset.fields?.some(f => f.value?.toLowerCase().includes(customerLocation))) {
                                    console.log(`✓ Location match: ${asset.name}`);
                                    asset.match_reason = 'התאמת מיקום';
                                    return true;
                                }
                            }
                        }
                        
                        console.log(`✗ No match: ${asset.name}`);
                        return false;
                    });
                    
                    console.log(`Found ${relatedAssets.length} related assets`);
                    
                    // 4. Create enhanced HTML response
                    const htmlMessage = `
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
                                    font-weight: 500;
                                }
                                .field-value {
                                    color: #24292e;
                                    font-weight: 500;
                                    font-size: 13px;
                                    word-break: break-word;
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
                                    flex: 1;
                                }
                                .related-type {
                                    background: #e3f2fd;
                                    color: #0969da;
                                    padding: 2px 6px;
                                    border-radius: 3px;
                                    font-size: 10px;
                                    font-weight: 600;
                                }
                                .match-badge {
                                    background: #e8f5e8;
                                    color: #28a745;
                                    padding: 2px 6px;
                                    border-radius: 3px;
                                    font-size: 9px;
                                    margin-left: 5px;
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
                                    font-weight: 500;
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
                                    ${customerAsset.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 8).map(field => `
                                        <div class='field-item'>
                                            <div class='field-label'>${field.label || 'Field'}</div>
                                            <div class='field-value'>${field.value || 'N/A'}</div>
                                        </div>
                                    `).join('') || '<div style="grid-column: 1 / -1; text-align: center; color: #666;">No fields available</div>'}
                                </div>
                            </div>
                            
                            <!-- Related Assets -->
                            ${relatedAssets.length > 0 ? `
                            <div class='detail-section'>
                                <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 14px;'>
                                    🔗 נכסים של ${customerAsset.name.split(' ')[0]} (${relatedAssets.length})
                                </h4>
                                ${relatedAssets.map(item => {
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
                                        <div class='related-item'>
                                            <div class='related-header' onclick='toggleRelated(this)'>
                                                <div class='related-title'>
                                                    <span>${icon}</span>
                                                    <span>${item.name || 'Unnamed Asset'}</span>
                                                    <span class='related-type'>${type}</span>
                                                    ${item.match_reason ? `<span class='match-badge'>${item.match_reason}</span>` : ''}
                                                </div>
                                                <span style='color: #586069; font-size: 12px; transition: transform 0.2s;'>▼</span>
                                            </div>
                                            <div class='related-details'>
                                                <!-- Basic Asset Info -->
                                                <div class='detail-row'>
                                                    <span class='detail-label'>Asset ID:</span>
                                                    <span class='detail-value'>${item.id || 'N/A'}</span>
                                                </div>
                                                <div class='detail-row'>
                                                    <span class='detail-label'>Asset Type:</span>
                                                    <span class='detail-value'>${item.asset_type || 'N/A'}</span>
                                                </div>
                                                ${item.primary_serial ? `
                                                <div class='detail-row'>
                                                    <span class='detail-label'>Serial Number:</span>
                                                    <span class='detail-value'>${item.primary_serial}</span>
                                                </div>
                                                ` : ''}
                                                ${item.primary_mail ? `
                                                <div class='detail-row'>
                                                    <span class='detail-label'>Email:</span>
                                                    <span class='detail-value'>${item.primary_mail}</span>
                                                </div>
                                                ` : ''}
                                                <!-- Custom Fields -->
                                                ${item.fields && item.fields.length > 0 ? item.fields.filter(f => f.value && f.value.toString().trim()).map(field => `
                                                    <div class='detail-row'>
                                                        <span class='detail-label'>${field.label || 'Field'}:</span>
                                                        <span class='detail-value'>${field.value}</span>
                                                    </div>
                                                `).join('') : '<div style="color: #666; font-style: italic; padding: 10px 0;">אין שדות נוספים</div>'}
                                                
                                                <div style='margin-top: 10px; padding-top: 10px; border-top: 1px solid #e1e4e8;'>
                                                    <a href='${item.url || '#'}' target='_blank' style='color: #0969da; text-decoration: none; font-size: 11px;'>
                                                        🔗 פתח ב-Hudu →
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ` : `
                            <div class='detail-section' style='text-align: center;'>
                                <p style='color: #586069; font-size: 12px; margin: 0;'>
                                    🔍 לא נמצאו נכסים קשורים ל-${customerAsset.name}<br>
                                    <small>חיפשנו ב-${allCompanyAssets.length} נכסים בחברה</small>
                                </p>
                            </div>
                            `}
                            
                            <!-- Footer -->
                            <div style='background: #f6f8fa; padding: 12px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center; margin-top: 20px;'>
                                <a href='${customerAsset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px;'>
                                    🔍 פתח פרטי לקוח ב-Hudu
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Enhanced search version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
