// Fixed Final Version - Hudu-BoldDesk Integration
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Helper function to normalize text for comparison
function normalizeText(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
        .replace(/[\s\-\_\.]+/g, ' ')  // Replace multiple spaces, dashes, underscores with single space
        .replace(/[^\u0590-\u05FF\w\s]/g, ''); // Keep Hebrew, English letters and spaces
}

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    // Handle GET requests - for testing
    if (req.method === 'GET') {
        const testMessage = `
            <div style='padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;'>
                <h3>✅ Hudu-BoldDesk Integration Active</h3>
                <p>Version 5.0 - Fixed</p>
                <p style='font-size: 11px;'>Time: ${new Date().toLocaleString()}</p>
            </div>
        `;
        
        res.status(200).json({
            "message": testMessage,
            "statusCode": "200"
        });
        return;
    }
    
    // Handle POST requests
    if (req.method === 'POST') {
        try {
            // Extract email from request
            let email = req.body?.requester?.EmailId ||
                       req.body?.requester?.email ||
                       req.body?.customer?.EmailId ||
                       req.body?.customer?.email ||
                       req.body?.EmailId ||
                       req.body?.email ||
                       null;
            
            console.log('Processing request for email:', email);
            
            // Check requirements
            if (!email) {
                res.status(200).json({
                    "message": `<div style='color: #dc2626; padding: 15px;'>❌ לא נמצא email בבקשה</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            if (!HUDU_API_KEY || !HUDU_BASE_URL) {
                res.status(200).json({
                    "message": `<div style='color: #dc2626; padding: 15px;'>❌ חסרים הגדרות API</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            // Step 1: Search for customer by email
            console.log('Searching for customer...');
            const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                headers: { 
                    'x-api-key': HUDU_API_KEY,
                    'Content-Type': 'application/json'
                },
                params: { 
                    search: email,
                    page_size: 50
                }
            });
            
            const searchResults = searchResponse.data?.assets || [];
            console.log(`Found ${searchResults.length} assets in search`);
            
            // Find the customer asset - handle both Mazkirut Goz and כרמלית לוי cases
            let customerAsset = null;
            let customerName = null;
            
            // First try to find People/Person/Contact asset
            for (const asset of searchResults) {
                const assetType = (asset.asset_type || '').toLowerCase();
                
                if (assetType.includes('people') || 
                    assetType.includes('person') || 
                    assetType.includes('contact') ||
                    assetType.includes('user')) {
                    customerAsset = asset;
                    customerName = asset.name;
                    console.log(`Found customer by type: ${customerName} (ID: ${asset.id})`);
                    break;
                }
            }
            
            // If not found by type, look for the asset with the email
            if (!customerAsset) {
                for (const asset of searchResults) {
                    if (asset.fields && Array.isArray(asset.fields)) {
                        for (const field of asset.fields) {
                            const fieldValue = (field.value || '').toString().toLowerCase().trim();
                            if (fieldValue === email.toLowerCase().trim()) {
                                customerAsset = asset;
                                customerName = asset.name;
                                console.log(`Found customer by email field: ${customerName} (ID: ${asset.id})`);
                                break;
                            }
                        }
                    }
                    if (customerAsset) break;
                }
            }
            
            // If still not found, use the first result
            if (!customerAsset && searchResults.length > 0) {
                customerAsset = searchResults[0];
                customerName = customerAsset.name;
                console.log(`Using first search result: ${customerName} (ID: ${customerAsset.id})`);
            }
            
            if (!customerAsset) {
                res.status(200).json({
                    "message": `<div style='color: #dc2626; padding: 15px;'>❌ לא נמצא לקוח עם המייל: ${email}</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            // Try to get detailed customer info (but don't fail if 404)
            let detailedCustomer = customerAsset;
            try {
                const detailResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`, {
                    headers: { 
                        'x-api-key': HUDU_API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (detailResponse.data?.asset) {
                    detailedCustomer = detailResponse.data.asset;
                    console.log('Got detailed customer data');
                }
            } catch (detailError) {
                console.log('Could not get detailed customer (404 or other error) - using basic data');
                // Continue with basic customer data
            }
            
            // Extract name parts for matching
            const fullName = normalizeText(customerName || detailedCustomer.name);
            const nameParts = fullName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            
            console.log('Customer name analysis:', { 
                original: customerName,
                normalized: fullName,
                firstName,
                lastName
            });
            
            // Step 2: Get all company assets
            let relatedAssets = [];
            const searchMethods = [];
            
            try {
                console.log('Getting company assets...');
                const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${detailedCustomer.company_id}/assets`, {
                    headers: { 
                        'x-api-key': HUDU_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    params: { 
                        page_size: 250,
                        archived: false
                    }
                });
                
                const companyAssets = companyResponse.data?.assets || [];
                console.log(`Found ${companyAssets.length} assets in company`);
                
                // Count asset types
                const assetTypeCount = {};
                companyAssets.forEach(asset => {
                    const type = asset.asset_type || 'Unknown';
                    assetTypeCount[type] = (assetTypeCount[type] || 0) + 1;
                });
                console.log('Asset types:', assetTypeCount);
                
                // Check each asset for relation to customer
                for (const asset of companyAssets) {
                    // Skip the customer asset itself
                    if (asset.id === customerAsset.id) continue;
                    
                    // Skip other people/contact assets
                    const assetType = (asset.asset_type || '').toLowerCase();
                    if (assetType.includes('people') || 
                        assetType.includes('person') || 
                        assetType.includes('contact') ||
                        assetType === 'contact in atera') {
                        continue;
                    }
                    
                    const assetNameNorm = normalizeText(asset.name);
                    let matchFound = false;
                    let matchReason = '';
                    let confidence = 'low';
                    
                    // Priority 1: Exact or full name match
                    if (fullName && (assetNameNorm === fullName || assetNameNorm.includes(fullName))) {
                        matchFound = true;
                        matchReason = 'Full name match';
                        confidence = 'high';
                    }
                    // Priority 2: Contains both first and last name (even not together)
                    else if (firstName && lastName && 
                             assetNameNorm.includes(firstName) && 
                             assetNameNorm.includes(lastName)) {
                        matchFound = true;
                        matchReason = 'First + Last name';
                        confidence = 'high';
                    }
                    // Priority 3: First name match (strong indicator)
                    else if (firstName && firstName.length > 2 && assetNameNorm.includes(firstName)) {
                        matchFound = true;
                        matchReason = `Contains "${firstName}"`;
                        confidence = 'medium';
                    }
                    // Priority 4: Last name match
                    else if (lastName && lastName.length > 2 && assetNameNorm.includes(lastName)) {
                        matchFound = true;
                        matchReason = `Contains "${lastName}"`;
                        confidence = 'medium';
                    }
                    
                    // Check fields for email or name match
                    if (!matchFound && asset.fields && Array.isArray(asset.fields)) {
                        for (const field of asset.fields) {
                            const fieldValueNorm = normalizeText(field.value);
                            
                            // Check for email match
                            if (email && field.value && field.value.toString().toLowerCase().includes(email.toLowerCase())) {
                                matchFound = true;
                                matchReason = `Email in ${field.label}`;
                                confidence = 'high';
                                break;
                            }
                            
                            // Check for name in fields
                            if (fullName && fieldValueNorm.includes(fullName)) {
                                matchFound = true;
                                matchReason = `Name in ${field.label}`;
                                confidence = 'high';
                                break;
                            }
                            
                            // Check for first name in fields (like "Assigned to")
                            if (firstName && firstName.length > 2 && fieldValueNorm.includes(firstName)) {
                                matchFound = true;
                                matchReason = `"${firstName}" in ${field.label}`;
                                confidence = 'medium';
                                break;
                            }
                        }
                    }
                    
                    // Special handling for specific asset types
                    if (!matchFound) {
                        // Email 365 assets - might not have the name but could be related
                        if (assetType.includes('email') || assetType.includes('365') || assetType.includes('office')) {
                            // Check if it's in a small company (likely user's email)
                            if (companyAssets.length <= 30) {
                                // Check if there's any name part match
                                if ((firstName && assetNameNorm.includes(firstName)) ||
                                    (lastName && assetNameNorm.includes(lastName))) {
                                    matchFound = true;
                                    matchReason = 'Email asset - name part match';
                                    confidence = 'medium';
                                }
                            }
                        }
                        
                        // Licenses, Passwords - often assigned to users
                        if (assetType.includes('license') || 
                            assetType.includes('password') || 
                            assetType.includes('credential')) {
                            if ((firstName && assetNameNorm.includes(firstName)) ||
                                (lastName && assetNameNorm.includes(lastName))) {
                                matchFound = true;
                                matchReason = `${assetType} - name match`;
                                confidence = 'medium';
                            }
                        }
                    }
                    
                    // For very small companies, include user-type assets
                    if (!matchFound && companyAssets.length <= 15) {
                        const userAssetTypes = ['computer', 'laptop', 'email', 'phone', 'printer', 
                                              'license', 'password', '365', 'office', 'mobile'];
                        if (userAssetTypes.some(type => assetType.includes(type))) {
                            matchFound = true;
                            matchReason = 'User asset - small company';
                            confidence = 'low';
                        }
                    }
                    
                    if (matchFound) {
                        console.log(`MATCH: ${asset.name} (${asset.asset_type}) - ${matchReason}`);
                        relatedAssets.push({
                            ...asset,
                            match_method: 'Smart Match',
                            match_reason: matchReason,
                            confidence: confidence
                        });
                    }
                }
                
                if (relatedAssets.length > 0) {
                    searchMethods.push('Smart Match');
                }
                
            } catch (error) {
                console.log('Error getting company assets:', error.message);
            }
            
            // Sort assets by confidence (high -> medium -> low)
            relatedAssets.sort((a, b) => {
                const order = { 'high': 3, 'medium': 2, 'low': 1 };
                return (order[b.confidence] || 0) - (order[a.confidence] || 0);
            });
            
            console.log(`Total found: ${relatedAssets.length} related assets`);
            
            // Generate HTML response
            const htmlMessage = `
                <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                    <style>
                        .header { 
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            padding: 15px; 
                            border-radius: 8px 8px 0 0; 
                            margin: -10px -10px 0 -10px; 
                        }
                        .customer-name { 
                            font-size: 18px; 
                            font-weight: 600; 
                            margin: 0 0 5px 0; 
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
                            border: 1px solid #dee2e6; 
                            transition: all 0.2s;
                        }
                        .asset-item:hover {
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        .asset-name { 
                            font-weight: 600; 
                            color: #212529; 
                            margin-bottom: 4px; 
                        }
                        .asset-type { 
                            display: inline-block;
                            background: #0ea5e9; 
                            color: white; 
                            padding: 2px 6px; 
                            border-radius: 8px; 
                            font-size: 10px; 
                            margin-right: 4px;
                        }
                        .confidence-high { 
                            background: #10b981; 
                            color: white; 
                            padding: 2px 6px; 
                            border-radius: 8px; 
                            font-size: 10px; 
                        }
                        .confidence-medium { 
                            background: #f59e0b; 
                            color: white; 
                            padding: 2px 6px; 
                            border-radius: 8px; 
                            font-size: 10px; 
                        }
                        .confidence-low { 
                            background: #6b7280; 
                            color: white; 
                            padding: 2px 6px; 
                            border-radius: 8px; 
                            font-size: 10px; 
                        }
                        .hudu-link {
                            background: #667eea;
                            color: white;
                            text-decoration: none;
                            padding: 8px 16px;
                            border-radius: 6px;
                            font-size: 12px;
                            display: inline-block;
                            margin-top: 10px;
                        }
                        .hudu-link:hover {
                            background: #5a67d8;
                        }
                    </style>
                    
                    <div class='header'>
                        <div class='customer-name'>👤 ${customerName || detailedCustomer.name}</div>
                        <div style='font-size: 11px; opacity: 0.9;'>
                            ${detailedCustomer.company_name || 'Company'} | 
                            Found: ${relatedAssets.length} items
                        </div>
                    </div>
                    
                    <div class='content'>
                        ${detailedCustomer.fields && detailedCustomer.fields.length > 0 ? `
                            <div style='background: white; border-radius: 6px; padding: 10px; margin-bottom: 15px; border: 1px solid #dee2e6;'>
                                <div style='display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;'>
                                    ${detailedCustomer.fields.filter(f => f.value).slice(0, 4).map(field => `
                                        <div style='font-size: 11px;'>
                                            <div style='color: #6c757d; font-size: 10px;'>${field.label}</div>
                                            <div style='color: #212529; font-weight: 500;'>${field.value}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <h3 style='font-size: 14px; margin: 0 0 10px 0;'>
                            🔗 נכסים קשורים (${relatedAssets.length})
                        </h3>
                        
                        ${relatedAssets.length > 0 ? relatedAssets.map(item => {
                            let icon = '📄';
                            const type = (item.asset_type || '').toLowerCase();
                            
                            if (type.includes('computer') || type.includes('laptop')) icon = '💻';
                            else if (type.includes('email') || type.includes('365') || type.includes('office')) icon = '📧';
                            else if (type.includes('print')) icon = '🖨️';
                            else if (type.includes('password') || type.includes('credential')) icon = '🔐';
                            else if (type.includes('license')) icon = '🔑';
                            else if (type.includes('phone') || type.includes('mobile')) icon = '📱';
                            else if (type.includes('server')) icon = '🖥️';
                            else if (type.includes('wireless') || type.includes('wifi')) icon = '📶';
                            
                            return `
                                <div class='asset-item'>
                                    <div class='asset-name'>${icon} ${item.name || 'Unnamed'}</div>
                                    <div style='margin-top: 4px;'>
                                        <span class='asset-type'>${item.asset_type || 'Asset'}</span>
                                        <span class='confidence-${item.confidence || 'low'}'>${item.match_reason || 'Related'}</span>
                                    </div>
                                    ${item.fields && item.fields.length > 0 ? `
                                        <div style='margin-top: 8px; font-size: 11px; color: #6c757d;'>
                                            ${item.fields.filter(f => f.value).slice(0, 2).map(f => 
                                                `${f.label}: ${f.value}`
                                            ).join(' | ')}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('') : `
                            <div style='text-align: center; padding: 30px; color: #6c757d; background: white; border-radius: 8px; border: 2px dashed #dee2e6;'>
                                <div style='font-size: 32px; margin-bottom: 10px;'>🔍</div>
                                <div style='font-size: 14px; font-weight: 600;'>לא נמצאו נכסים קשורים</div>
                                <div style='font-size: 12px; margin-top: 5px;'>נסה לבדוק את ההגדרות ב-Hudu</div>
                            </div>
                        `}
                        
                        <div style='text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;'>
                            <a href='${HUDU_BASE_URL}/a/${detailedCustomer.company_id}/assets/${customerAsset.id}' 
                               target='_blank' 
                               class='hudu-link'>
                                פתח פרופיל לקוח ב-Hudu →
                            </a>
                        </div>
                    </div>
                </div>
            `;
            
            res.status(200).json({
                "message": htmlMessage,
                "statusCode": "200"
            });
            
            console.log('Response sent successfully');
            
        } catch (error) {
            console.error('Main error:', error);
            
            res.status(200).json({
                "message": `<div style='color: #dc2626; padding: 15px;'>❌ שגיאה: ${error.message}</div>`,
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
