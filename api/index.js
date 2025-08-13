// Show ALL company assets - let user see everything
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
                    
                    // 3. Remove customer asset and show ALL others
                    const otherAssets = allCompanyAssets.filter(asset => asset.id !== customerAsset.id);
                    
                    // 4. Create HTML showing ALL assets with expand/collapse
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
                                .asset-item {
                                    background: white;
                                    border: 1px solid #e1e4e8;
                                    border-radius: 6px;
                                    margin: 8px 0;
                                    overflow: hidden;
                                }
                                .asset-header {
                                    background: #f6f8fa;
                                    padding: 10px 12px;
                                    border-bottom: 1px solid #e1e4e8;
                                    cursor: pointer;
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: center;
                                }
                                .asset-header:hover {
                                    background: #f0f2f5;
                                }
                                .asset-title {
                                    font-weight: 500;
                                    color: #24292e;
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                    flex: 1;
                                }
                                .asset-type {
                                    background: #e3f2fd;
                                    color: #0969da;
                                    padding: 2px 6px;
                                    border-radius: 3px;
                                    font-size: 10px;
                                    font-weight: 600;
                                }
                                .asset-details {
                                    display: none;
                                    padding: 12px;
                                }
                                .asset-details.show {
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
                            
                            <!-- All Company Assets -->
                            <div class='detail-section'>
                                <h4 style='margin: 0 0 10px 0; color: #24292e; font-size: 14px;'>
                                    📋 כל הנכסים בחברה (${otherAssets.length})
                                </h4>
                                <p style='color: #666; font-size: 12px; margin: 0 0 15px 0;'>
                                    לחץ על כל נכס כדי לראות את הפרטים שלו
                                </p>
                                ${otherAssets.map(item => {
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
                                            <div class='asset-header' onclick='toggleAsset(this)'>
                                                <div class='asset-title'>
                                                    <span>${icon}</span>
                                                    <span>${item.name || 'Unnamed Asset'}</span>
                                                    <span class='asset-type'>${type}</span>
                                                </div>
                                                <span style='color: #586069; font-size: 12px; transition: transform 0.2s;'>▼</span>
                                            </div>
                                            <div class='asset-details'>
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
                            
                            <!-- Footer -->
                            <div style='background: #f6f8fa; padding: 12px; border: 1px solid #e1e4e8; border-radius: 0 0 8px 8px; text-align: center; margin-top: 20px;'>
                                <a href='${customerAsset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 12px;'>
                                    🔍 פתח פרטי לקוח ב-Hudu
                                </a>
                            </div>
                            
                            <script>
                                function toggleAsset(header) {
                                    const details = header.nextElementSibling;
                                    const arrow = header.querySelector('span:last-child');
                                    
                                    if (details.classList.contains('show')) {
                                        details.classList.remove('show');
                                        arrow.style.transform = 'rotate(0deg)';
                                    } else {
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Show all assets version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
