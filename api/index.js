// Beautiful Design Version - Hudu-BoldDesk Integration
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Asset type icons mapping
function getAssetIcon(assetType) {
    const type = (assetType || '').toLowerCase();
    
    if (type.includes('computer') || type.includes('laptop') || type.includes('desktop')) return '💻';
    if (type.includes('email') || type.includes('365') || type.includes('office')) return '📧';
    if (type.includes('print')) return '🖨️';
    if (type.includes('phone') || type.includes('mobile')) return '📱';
    if (type.includes('license') || type.includes('subscription')) return '🔑';
    if (type.includes('password') || type.includes('credential')) return '🔐';
    if (type.includes('server')) return '🖥️';
    if (type.includes('wireless') || type.includes('wifi')) return '📶';
    if (type.includes('build') || type.includes('office')) return '🏢';
    if (type.includes('application') || type.includes('whatsapp')) return '📱';
    
    return '📄';
}

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    if (req.method === 'GET') {
        res.status(200).json({
            "message": `
                <div style='padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>
                    <h3 style='margin: 0; font-size: 20px;'>✨ Hudu-BoldDesk Integration</h3>
                    <p style='margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;'>Version 7.0 - Beautiful Design</p>
                </div>
            `,
            "statusCode": "200"
        });
        return;
    }
    
    if (req.method === 'POST') {
        try {
            // Extract email
            let email = req.body?.requester?.EmailId ||
                       req.body?.requester?.email ||
                       req.body?.customer?.EmailId ||
                       req.body?.customer?.email ||
                       req.body?.EmailId ||
                       req.body?.email ||
                       null;
            
            console.log('Processing for email:', email);
            
            if (!email || !HUDU_API_KEY || !HUDU_BASE_URL) {
                res.status(200).json({
                    "message": `
                        <div style='padding: 15px; background: #fee2e2; color: #dc2626; border-radius: 8px; border-left: 4px solid #dc2626;'>
                            <strong>⚠️ שגיאה</strong><br/>
                            <span style='font-size: 12px;'>חסרים נתונים נדרשים</span>
                        </div>
                    `,
                    "statusCode": "200"
                });
                return;
            }
            
            // Search for customer
            const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { search: email, page_size: 50 }
            });
            
            const searchResults = searchResponse.data?.assets || [];
            
            // Find customer
            let customerAsset = null;
            for (const asset of searchResults) {
                const assetType = (asset.asset_type || '').toLowerCase();
                if (assetType.includes('people') || 
                    assetType.includes('person') || 
                    assetType.includes('contact')) {
                    customerAsset = asset;
                    break;
                }
            }
            
            if (!customerAsset && searchResults.length > 0) {
                customerAsset = searchResults[0];
            }
            
            if (!customerAsset) {
                res.status(200).json({
                    "message": `
                        <div style='padding: 20px; background: #fee2e2; color: #dc2626; border-radius: 8px; text-align: center;'>
                            <div style='font-size: 32px; margin-bottom: 10px;'>❌</div>
                            <strong>לא נמצא לקוח</strong><br/>
                            <span style='font-size: 12px;'>לא נמצא פרופיל עבור: ${email}</span>
                        </div>
                    `,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`Customer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            
            // Get company assets
            const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { page_size: 250, archived: false }
            });
            
            const companyAssets = companyResponse.data?.assets || [];
            const totalAssets = companyAssets.length;
            const isSmallCompany = totalAssets <= 35;
            
            let relatedAssets = [];
            const customerName = (customerAsset.name || '').toLowerCase().trim();
            const nameParts = customerName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            
            for (const asset of companyAssets) {
                if (asset.id === customerAsset.id) continue;
                
                const assetType = (asset.asset_type || '').toLowerCase();
                
                // Skip other people
                if (assetType.includes('people') || 
                    assetType.includes('person') || 
                    assetType.includes('contact') ||
                    assetType === 'contact in atera') {
                    continue;
                }
                
                const assetName = (asset.name || '').toLowerCase();
                let shouldInclude = false;
                let matchReason = '';
                let confidence = 'low';
                
                // Check for name matches
                if (customerName && assetName.includes(customerName)) {
                    shouldInclude = true;
                    matchReason = 'התאמה מלאה';
                    confidence = 'high';
                } else if (firstName && assetName.includes(firstName)) {
                    shouldInclude = true;
                    matchReason = 'שם פרטי';
                    confidence = 'medium';
                } else if (lastName && assetName.includes(lastName)) {
                    shouldInclude = true;
                    matchReason = 'שם משפחה';
                    confidence = 'medium';
                }
                
                // Check fields
                if (!shouldInclude && asset.fields) {
                    for (const field of asset.fields) {
                        if (!field.value) continue;
                        const fieldValue = field.value.toString().toLowerCase();
                        
                        if (email && fieldValue.includes(email.toLowerCase())) {
                            shouldInclude = true;
                            matchReason = 'Email תואם';
                            confidence = 'high';
                            break;
                        }
                        
                        if (customerName && fieldValue.includes(customerName)) {
                            shouldInclude = true;
                            matchReason = 'שם בשדות';
                            confidence = 'high';
                            break;
                        }
                    }
                }
                
                // Small company logic
                if (!shouldInclude && isSmallCompany) {
                    const userAssetTypes = [
                        'computer', 'laptop', 'desktop', 'workstation',
                        'email', '365', 'office', 'mailbox',
                        'phone', 'mobile', 'extension',
                        'license', 'subscription',
                        'password', 'credential',
                        'printer', 'scanner'
                    ];
                    
                    const isUserAsset = userAssetTypes.some(type => assetType.includes(type));
                    
                    if (isUserAsset) {
                        const peopleCount = companyAssets.filter(a => {
                            const t = (a.asset_type || '').toLowerCase();
                            return t.includes('people') || t.includes('person') || t.includes('contact');
                        }).length;
                        
                        if (peopleCount <= 20) {
                            shouldInclude = true;
                            matchReason = 'נכס משתמש';
                            confidence = 'low';
                            
                            if (assetType.includes('email') || assetType.includes('365')) {
                                confidence = 'medium';
                                matchReason = 'Email/365';
                            }
                            
                            if (assetName.includes('maz') || assetName.includes('goz')) {
                                confidence = 'medium';
                                matchReason = 'נכס חברה';
                            }
                        }
                    }
                }
                
                if (shouldInclude) {
                    relatedAssets.push({
                        ...asset,
                        match_reason: matchReason,
                        confidence: confidence
                    });
                }
            }
            
            // Sort by confidence
            relatedAssets.sort((a, b) => {
                const order = { 'high': 3, 'medium': 2, 'low': 1 };
                return (order[b.confidence] || 0) - (order[a.confidence] || 0);
            });
            
            console.log(`Found ${relatedAssets.length} related assets`);
            
            // Generate beautiful HTML
            const htmlMessage = `
                <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", Arial, sans-serif; font-size: 13px; direction: rtl;'>
                    <style>
                        * { box-sizing: border-box; }
                        
                        .container {
                            background: white;
                            border-radius: 12px;
                            overflow: hidden;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        }
                        
                        .header {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 20px;
                            position: relative;
                        }
                        
                        .header::after {
                            content: '';
                            position: absolute;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            height: 4px;
                            background: rgba(255,255,255,0.2);
                        }
                        
                        .customer-info {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 8px;
                        }
                        
                        .customer-name {
                            font-size: 20px;
                            font-weight: 600;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .company-badge {
                            background: rgba(255,255,255,0.2);
                            backdrop-filter: blur(10px);
                            padding: 6px 12px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 500;
                        }
                        
                        .stats {
                            display: flex;
                            gap: 15px;
                            font-size: 12px;
                            opacity: 0.9;
                        }
                        
                        .stat {
                            display: flex;
                            align-items: center;
                            gap: 5px;
                        }
                        
                        .content {
                            padding: 20px;
                            background: #f8f9fa;
                        }
                        
                        .section-title {
                            font-size: 15px;
                            font-weight: 600;
                            color: #1f2937;
                            margin: 0 0 15px 0;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        
                        .count-badge {
                            background: #667eea;
                            color: white;
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: 600;
                        }
                        
                        .assets-grid {
                            display: grid;
                            gap: 12px;
                        }
                        
                        .asset-card {
                            background: white;
                            border-radius: 10px;
                            padding: 14px;
                            border: 1px solid #e5e7eb;
                            transition: all 0.2s;
                            display: grid;
                            grid-template-columns: auto 1fr auto;
                            gap: 12px;
                            align-items: center;
                        }
                        
                        .asset-card:hover {
                            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                            transform: translateY(-2px);
                            border-color: #667eea;
                        }
                        
                        .asset-card.high {
                            border-left: 3px solid #10b981;
                        }
                        
                        .asset-card.medium {
                            border-left: 3px solid #f59e0b;
                        }
                        
                        .asset-card.low {
                            border-left: 3px solid #9ca3af;
                        }
                        
                        .asset-icon {
                            font-size: 24px;
                            width: 40px;
                            height: 40px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f3f4f6;
                            border-radius: 10px;
                        }
                        
                        .asset-details {
                            flex: 1;
                            min-width: 0;
                        }
                        
                        .asset-name {
                            font-weight: 600;
                            color: #1f2937;
                            font-size: 14px;
                            margin-bottom: 4px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                        
                        .asset-meta {
                            display: flex;
                            gap: 6px;
                            flex-wrap: wrap;
                            align-items: center;
                        }
                        
                        .badge {
                            display: inline-flex;
                            align-items: center;
                            padding: 3px 8px;
                            border-radius: 6px;
                            font-size: 10px;
                            font-weight: 600;
                            white-space: nowrap;
                        }
                        
                        .type-badge {
                            background: #e0e7ff;
                            color: #4338ca;
                        }
                        
                        .match-badge {
                            background: #f3f4f6;
                            color: #4b5563;
                        }
                        
                        .confidence-indicator {
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                        }
                        
                        .confidence-indicator.high {
                            background: #10b981;
                        }
                        
                        .confidence-indicator.medium {
                            background: #f59e0b;
                        }
                        
                        .confidence-indicator.low {
                            background: #9ca3af;
                        }
                        
                        .info-box {
                            background: #fef3c7;
                            border: 1px solid #fcd34d;
                            border-radius: 8px;
                            padding: 12px;
                            margin-bottom: 20px;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .info-icon {
                            font-size: 20px;
                        }
                        
                        .info-text {
                            flex: 1;
                            font-size: 12px;
                            color: #78350f;
                        }
                        
                        .footer {
                            padding: 20px;
                            background: white;
                            border-top: 1px solid #e5e7eb;
                            text-align: center;
                        }
                        
                        .hudu-button {
                            display: inline-flex;
                            align-items: center;
                            gap: 8px;
                            background: #667eea;
                            color: white;
                            text-decoration: none;
                            padding: 10px 20px;
                            border-radius: 8px;
                            font-size: 13px;
                            font-weight: 600;
                            transition: all 0.2s;
                        }
                        
                        .hudu-button:hover {
                            background: #5a67d8;
                            transform: translateY(-1px);
                            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                        }
                        
                        .empty-state {
                            text-align: center;
                            padding: 40px;
                            background: white;
                            border-radius: 10px;
                            border: 2px dashed #e5e7eb;
                        }
                        
                        .empty-icon {
                            font-size: 48px;
                            margin-bottom: 15px;
                            opacity: 0.5;
                        }
                        
                        .empty-title {
                            font-size: 16px;
                            font-weight: 600;
                            color: #4b5563;
                            margin-bottom: 5px;
                        }
                        
                        .empty-text {
                            font-size: 13px;
                            color: #9ca3af;
                        }
                    </style>
                    
                    <div class='container'>
                        <!-- Header -->
                        <div class='header'>
                            <div class='customer-info'>
                                <div class='customer-name'>
                                    <span>👤</span>
                                    <span>${customerAsset.name}</span>
                                </div>
                                <div class='company-badge'>
                                    ${customerAsset.company_name || 'חברה'}
                                </div>
                            </div>
                            <div class='stats'>
                                <div class='stat'>
                                    <span>🏢</span>
                                    <span>${totalAssets} נכסים בחברה</span>
                                </div>
                                <div class='stat'>
                                    <span>🔗</span>
                                    <span>${relatedAssets.length} נכסים קשורים</span>
                                </div>
                                ${isSmallCompany ? `
                                    <div class='stat'>
                                        <span>✨</span>
                                        <span>חברה קטנה</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- Content -->
                        <div class='content'>
                            ${isSmallCompany ? `
                                <div class='info-box'>
                                    <div class='info-icon'>💡</div>
                                    <div class='info-text'>
                                        <strong>מצב חברה קטנה:</strong> 
                                        מציג את כל נכסי המשתמש הפוטנציאליים (${totalAssets} נכסים בסה"כ)
                                    </div>
                                </div>
                            ` : ''}
                            
                            <h3 class='section-title'>
                                <span>🔗</span>
                                <span>נכסים קשורים</span>
                                <span class='count-badge'>${relatedAssets.length}</span>
                            </h3>
                            
                            ${relatedAssets.length > 0 ? `
                                <div class='assets-grid'>
                                    ${relatedAssets.map(item => {
                                        const icon = getAssetIcon(item.asset_type);
                                        
                                        return `
                                            <div class='asset-card ${item.confidence}'>
                                                <div class='asset-icon'>${icon}</div>
                                                <div class='asset-details'>
                                                    <div class='asset-name' title='${item.name}'>${item.name}</div>
                                                    <div class='asset-meta'>
                                                        <span class='badge type-badge'>${item.asset_type}</span>
                                                        <span class='badge match-badge'>${item.match_reason}</span>
                                                    </div>
                                                </div>
                                                <div class='confidence-indicator ${item.confidence}' title='רמת התאמה: ${
                                                    item.confidence === 'high' ? 'גבוהה' :
                                                    item.confidence === 'medium' ? 'בינונית' : 'נמוכה'
                                                }'></div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `
                                <div class='empty-state'>
                                    <div class='empty-icon'>🔍</div>
                                    <div class='empty-title'>לא נמצאו נכסים קשורים</div>
                                    <div class='empty-text'>לא נמצאו נכסים המקושרים ללקוח זה</div>
                                </div>
                            `}
                        </div>
                        
                        <!-- Footer -->
                        <div class='footer'>
                            <a href='${HUDU_BASE_URL}/a/${customerAsset.company_id}/assets/${customerAsset.id}' 
                               target='_blank' 
                               class='hudu-button'>
                                <span>פתח ב-Hudu</span>
                                <span>→</span>
                            </a>
                        </div>
                    </div>
                </div>
            `;
            
            res.status(200).json({
                "message": htmlMessage,
                "statusCode": "200"
            });
            
        } catch (error) {
            console.error('Error:', error);
            res.status(200).json({
                "message": `
                    <div style='padding: 20px; background: #fee2e2; color: #dc2626; border-radius: 8px; text-align: center;'>
                        <div style='font-size: 32px; margin-bottom: 10px;'>⚠️</div>
                        <strong>אירעה שגיאה</strong><br/>
                        <span style='font-size: 12px;'>${error.message}</span>
                    </div>
                `,
                "statusCode": "500"
            });
        }
    } else {
        res.status(405).json({ 
            error: 'Method not allowed',
            allowed: ['GET', 'POST']
        });
    }
};
