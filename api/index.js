// Stable Hudu-BoldDesk Integration
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    // Handle GET requests - for testing
    if (req.method === 'GET') {
        const testMessage = `
            <div style='padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;'>
                <h3>✅ Hudu-BoldDesk Integration Active</h3>
                <p>Version 4.0 - Stable</p>
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
            let email = null;
            
            // Try different possible locations for email
            if (req.body?.requester?.EmailId) {
                email = req.body.requester.EmailId;
            } else if (req.body?.requester?.email) {
                email = req.body.requester.email;
            } else if (req.body?.customer?.EmailId) {
                email = req.body.customer.EmailId;
            } else if (req.body?.customer?.email) {
                email = req.body.customer.email;
            } else if (req.body?.EmailId) {
                email = req.body.EmailId;
            } else if (req.body?.email) {
                email = req.body.email;
            }
            
            console.log('Extracted email:', email);
            
            // Check if we have all required data
            if (!email) {
                const errorMessage = `
                    <div style='color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                        <strong>❌ שגיאה</strong><br/>
                        <span style='font-size: 12px;'>לא נמצא email בבקשה</span>
                    </div>
                `;
                
                res.status(200).json({
                    "message": errorMessage,
                    "statusCode": "200"
                });
                return;
            }
            
            if (!HUDU_API_KEY || !HUDU_BASE_URL) {
                const errorMessage = `
                    <div style='color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                        <strong>❌ שגיאת הגדרות</strong><br/>
                        <span style='font-size: 12px;'>חסרים API Key או Base URL</span>
                    </div>
                `;
                
                res.status(200).json({
                    "message": errorMessage,
                    "statusCode": "200"
                });
                return;
            }
            
            // Step 1: Search for customer by email
            console.log('Searching for customer with email:', email);
            
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
            
            const allAssets = searchResponse.data?.assets || [];
            console.log(`Found ${allAssets.length} assets in search`);
            
            // Find the customer asset
            let customerAsset = null;
            
            for (const asset of allAssets) {
                const assetType = (asset.asset_type || '').toLowerCase();
                
                // Check if it's a person/contact asset
                if (assetType.includes('people') || 
                    assetType.includes('person') || 
                    assetType.includes('contact') ||
                    assetType.includes('user') ||
                    assetType.includes('employee')) {
                    customerAsset = asset;
                    break;
                }
                
                // Check fields for exact email match
                if (asset.fields && Array.isArray(asset.fields)) {
                    for (const field of asset.fields) {
                        const fieldValue = (field.value || '').toString().toLowerCase().trim();
                        if (fieldValue === email.toLowerCase().trim()) {
                            customerAsset = asset;
                            break;
                        }
                    }
                }
                
                if (customerAsset) break;
            }
            
            if (!customerAsset) {
                const errorMessage = `
                    <div style='color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                        <strong>❌ לא נמצא לקוח</strong><br/>
                        <span style='font-size: 12px;'>לא נמצא פרופיל לקוח עם המייל: ${email}</span>
                    </div>
                `;
                
                res.status(200).json({
                    "message": errorMessage,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`Found customer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            
            // Step 2: Get detailed customer information
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
                console.log('Could not get detailed customer:', detailError.message);
            }
            
            // Step 3: Find related assets
            let relatedAssets = [];
            const searchMethods = [];
            
            // Extract customer identifiers
            const customerName = detailedCustomer.name.toLowerCase().trim();
            const nameParts = customerName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            
            console.log('Customer identifiers:', { name: customerName, firstName, lastName });
            
            // Method 1: Get assets from the same company
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
                
                // Filter assets that might be related
                for (const asset of companyAssets) {
                    // Skip the customer asset itself
                    if (asset.id === customerAsset.id) continue;
                    
                    // Skip other people assets
                    const assetType = (asset.asset_type || '').toLowerCase();
                    if (assetType.includes('people') || 
                        assetType.includes('person') || 
                        assetType.includes('contact')) {
                        continue;
                    }
                    
                    const assetName = (asset.name || '').toLowerCase();
                    let matchFound = false;
                    let matchReason = '';
                    let confidence = 'low';
                    
                    // Check for name match in asset name
                    if (customerName && assetName.includes(customerName)) {
                        matchFound = true;
                        matchReason = 'Full name match';
                        confidence = 'high';
                    } else if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                        matchFound = true;
                        matchReason = `Contains "${firstName}"`;
                        confidence = 'medium';
                    } else if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                        matchFound = true;
                        matchReason = `Contains "${lastName}"`;
                        confidence = 'medium';
                    }
                    
                    // Check fields for matches
                    if (!matchFound && asset.fields && Array.isArray(asset.fields)) {
                        for (const field of asset.fields) {
                            const fieldValue = (field.value || '').toString().toLowerCase();
                            
                            if (email && fieldValue.includes(email.toLowerCase())) {
                                matchFound = true;
                                matchReason = `Email in ${field.label}`;
                                confidence = 'high';
                                break;
                            }
                            
                            if (customerName && fieldValue.includes(customerName)) {
                                matchFound = true;
                                matchReason = `Name in ${field.label}`;
                                confidence = 'high';
                                break;
                            }
                            
                            if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                matchFound = true;
                                matchReason = `"${firstName}" in ${field.label}`;
                                confidence = 'medium';
                                break;
                            }
                        }
                    }
                    
                    // Check if it's a user-type asset in a small company
                    if (!matchFound && companyAssets.length <= 20) {
                        const userTypes = ['computer', 'laptop', 'email', 'phone', 'printer', 
                                         'license', 'password', '365', 'office'];
                        if (userTypes.some(type => assetType.includes(type))) {
                            matchFound = true;
                            matchReason = 'User asset - small company';
                            confidence = 'low';
                        }
                    }
                    
                    if (matchFound) {
                        relatedAssets.push({
                            ...asset,
                            match_method: 'Smart Match',
                            match_reason: matchReason,
                            confidence: confidence
                        });
                        console.log(`Found related: ${asset.name} - ${matchReason}`);
                    }
                }
                
                if (relatedAssets.length > 0) {
                    searchMethods.push('Smart Match');
                }
                
            } catch (error) {
                console.log('Error getting company assets:', error.message);
            }
            
            // Method 2: Search by name if we need more results
            if (relatedAssets.length < 5 && firstName) {
                try {
                    console.log('Searching by name...');
                    
                    const nameSearchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                        headers: { 
                            'x-api-key': HUDU_API_KEY,
                            'Content-Type': 'application/json'
                        },
                        params: { 
                            search: firstName,
                            page_size: 25,
                            company_id: detailedCustomer.company_id
                        }
                    });
                    
                    const nameAssets = nameSearchResponse.data?.assets || [];
                    
                    for (const asset of nameAssets) {
                        // Skip if already found or is the customer
                        if (asset.id === customerAsset.id || 
                            relatedAssets.find(a => a.id === asset.id)) {
                            continue;
                        }
                        
                        const assetType = (asset.asset_type || '').toLowerCase();
                        if (!assetType.includes('people') && !assetType.includes('person')) {
                            relatedAssets.push({
                                ...asset,
                                match_method: 'Name Search',
                                match_reason: 'Name match',
                                confidence: 'medium'
                            });
                        }
                    }
                    
                    if (nameAssets.length > 0) {
                        searchMethods.push('Name Search');
                    }
                    
                } catch (error) {
                    console.log('Name search error:', error.message);
                }
            }
            
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
                    </style>
                    
                    <div class='header'>
                        <div class='customer-name'>👤 ${detailedCustomer.name}</div>
                        <div style='font-size: 11px; opacity: 0.9;'>
                            ${detailedCustomer.company_name || 'Company'} | 
                            Found: ${relatedAssets.length} items
                        </div>
                    </div>
                    
                    <div class='content'>
                        <h3 style='font-size: 14px; margin: 0 0 10px 0;'>🔗 נכסים קשורים (${relatedAssets.length})</h3>
                        
                        ${relatedAssets.length > 0 ? relatedAssets.map(item => `
                            <div class='asset-item'>
                                <div class='asset-name'>${item.name || 'Unnamed'}</div>
                                <div>
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
                        `).join('') : `
                            <div style='text-align: center; padding: 20px; color: #6c757d;'>
                                🔍 לא נמצאו נכסים קשורים
                            </div>
                        `}
                        
                        <div style='text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #dee2e6;'>
                            <a href='${HUDU_BASE_URL}/a/${detailedCustomer.company_id}/assets/${detailedCustomer.id}' 
                               target='_blank' 
                               style='background: #667eea; color: white; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; display: inline-block;'>
                                פתח פרופיל לקוח ב-Hudu →
                            </a>
                        </div>
                    </div>
                </div>
            `;
            
            // Send successful response
            res.status(200).json({
                "message": htmlMessage,
                "statusCode": "200"
            });
            
        } catch (error) {
            console.error('Main error:', error);
            
            const errorMessage = `
                <div style='color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                    <strong>❌ שגיאה</strong><br/>
                    <span style='font-size: 12px;'>${error.message}</span>
                </div>
            `;
            
            res.status(200).json({
                "message": errorMessage,
                "statusCode": "500"
            });
        }
    } else {
        // Method not allowed
        res.status(405).json({ 
            error: 'Method not allowed',
            allowed: ['GET', 'POST']
        });
    }
};
