// Temporary Solution - Include more assets for small companies
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    if (req.method === 'GET') {
        res.status(200).json({
            "message": `
                <div style='padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;'>
                    <h3>✅ Hudu-BoldDesk Integration</h3>
                    <p>Version 6.0 - Small Company Support</p>
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
                    "message": `<div style='color: red; padding: 15px;'>Missing requirements</div>`,
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
                    "message": `<div style='color: red; padding: 15px;'>לא נמצא לקוח</div>`,
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
            console.log(`Company has ${totalAssets} assets`);
            
            // Determine if it's a small company
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
                    matchReason = 'Full name match';
                    confidence = 'high';
                } else if (firstName && assetName.includes(firstName)) {
                    shouldInclude = true;
                    matchReason = `Contains "${firstName}"`;
                    confidence = 'medium';
                } else if (lastName && assetName.includes(lastName)) {
                    shouldInclude = true;
                    matchReason = `Contains "${lastName}"`;
                    confidence = 'medium';
                }
                
                // Check fields for email/name
                if (!shouldInclude && asset.fields) {
                    for (const field of asset.fields) {
                        if (!field.value) continue;
                        const fieldValue = field.value.toString().toLowerCase();
                        
                        if (email && fieldValue.includes(email.toLowerCase())) {
                            shouldInclude = true;
                            matchReason = `Email in ${field.label}`;
                            confidence = 'high';
                            break;
                        }
                        
                        if (customerName && fieldValue.includes(customerName)) {
                            shouldInclude = true;
                            matchReason = `Name in ${field.label}`;
                            confidence = 'high';
                            break;
                        }
                    }
                }
                
                // SPECIAL LOGIC FOR SMALL COMPANIES
                if (!shouldInclude && isSmallCompany) {
                    // Include all user-type assets in small companies
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
                        // Count how many people are in the company
                        const peopleCount = companyAssets.filter(a => {
                            const t = (a.asset_type || '').toLowerCase();
                            return t.includes('people') || t.includes('person') || t.includes('contact');
                        }).length;
                        
                        // If there are few people, include the asset
                        if (peopleCount <= 20) {
                            shouldInclude = true;
                            matchReason = `Likely user asset (${totalAssets} assets company)`;
                            confidence = 'low';
                            
                            // Boost confidence for certain types
                            if (assetType.includes('email') || assetType.includes('365')) {
                                confidence = 'medium';
                                matchReason = `Email/365 in small company`;
                            }
                            
                            // Special case: if asset name contains "maz" or "goz" (from company name)
                            if (assetName.includes('maz') || assetName.includes('goz') || assetName.includes('כרמלית')) {
                                confidence = 'medium';
                                matchReason = `Company/role related asset`;
                            }
                        }
                    }
                }
                
                if (shouldInclude) {
                    console.log(`Including: ${asset.name} (${asset.asset_type}) - ${matchReason}`);
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
            
            // Generate HTML
            const htmlMessage = `
                <div style='font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 13px;'>
                    <style>
                        .header { 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 15px; 
                            border-radius: 8px 8px 0 0; 
                            margin: -10px -10px 0 -10px; 
                        }
                        .content { 
                            padding: 15px; 
                            background: #f8f9fa; 
                            border-radius: 0 0 8px 8px; 
                            margin: 0 -10px -10px -10px; 
                        }
                        .asset-item { 
                            background: white; 
                            border-radius: 6px; 
                            padding: 12px; 
                            margin: 8px 0; 
                            border-left: 3px solid #667eea;
                        }
                        .asset-item.high { border-left-color: #10b981; }
                        .asset-item.medium { border-left-color: #f59e0b; }
                        .asset-item.low { border-left-color: #6b7280; }
                        .asset-name { 
                            font-weight: 600; 
                            color: #212529; 
                            margin-bottom: 4px; 
                        }
                        .badge {
                            display: inline-block;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 10px;
                            font-weight: 600;
                            margin-right: 4px;
                        }
                        .type-badge { 
                            background: #e0e7ff; 
                            color: #4338ca;
                        }
                        .confidence-high { 
                            background: #d1fae5; 
                            color: #065f46;
                        }
                        .confidence-medium { 
                            background: #fed7aa; 
                            color: #92400e;
                        }
                        .confidence-low { 
                            background: #f3f4f6; 
                            color: #374151;
                        }
                        .info-box {
                            background: #fef3c7;
                            border: 1px solid #fbbf24;
                            border-radius: 6px;
                            padding: 10px;
                            margin-bottom: 15px;
                            font-size: 11px;
                        }
                    </style>
                    
                    <div class='header'>
                        <div style='font-size: 18px; font-weight: 600;'>👤 ${customerAsset.name}</div>
                        <div style='font-size: 11px; opacity: 0.9; margin-top: 5px;'>
                            ${customerAsset.company_name || 'Company'} | 
                            ${totalAssets} assets total | 
                            Found: ${relatedAssets.length} related
                        </div>
                    </div>
                    
                    <div class='content'>
                        ${isSmallCompany ? `
                            <div class='info-box'>
                                💡 <strong>Small company detected:</strong> Including all potential user assets
                                (${totalAssets} total assets in company)
                            </div>
                        ` : ''}
                        
                        <h3 style='font-size: 14px; margin: 0 0 10px 0;'>
                            🔗 נכסים קשורים (${relatedAssets.length})
                        </h3>
                        
                        ${relatedAssets.length > 0 ? relatedAssets.map(item => {
                            let icon = '📄';
                            const type = (item.asset_type || '').toLowerCase();
                            
                            if (type.includes('computer') || type.includes('laptop')) icon = '💻';
                            else if (type.includes('email') || type.includes('365')) icon = '📧';
                            else if (type.includes('print')) icon = '🖨️';
                            else if (type.includes('phone')) icon = '📱';
                            else if (type.includes('license')) icon = '🔑';
                            else if (type.includes('password')) icon = '🔐';
                            
                            return `
                                <div class='asset-item ${item.confidence}'>
                                    <div class='asset-name'>${icon} ${item.name}</div>
                                    <div>
                                        <span class='badge type-badge'>${item.asset_type}</span>
                                        <span class='badge confidence-${item.confidence}'>${item.match_reason}</span>
                                    </div>
                                    ${item.fields && item.fields.filter(f => f.value).length > 0 ? `
                                        <div style='margin-top: 6px; font-size: 11px; color: #6b7280;'>
                                            ${item.fields.filter(f => f.value).slice(0, 2).map(f => 
                                                `${f.label}: ${f.value}`
                                            ).join(' | ')}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('') : `
                            <div style='text-align: center; padding: 30px; color: #6b7280;'>
                                🔍 לא נמצאו נכסים קשורים
                            </div>
                        `}
                        
                        <div style='text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;'>
                            <a href='${HUDU_BASE_URL}/a/${customerAsset.company_id}/assets/${customerAsset.id}' 
                               target='_blank' 
                               style='background: #667eea; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; display: inline-block;'>
                                פתח ב-Hudu →
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
                "message": `<div style='color: red; padding: 15px;'>Error: ${error.message}</div>`,
                "statusCode": "500"
            });
        }
    }
};
