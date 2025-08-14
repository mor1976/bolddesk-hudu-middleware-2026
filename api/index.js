// Enhanced Hudu-BoldDesk Integration with improved asset discovery
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Helper function to extract unique values from fields
function extractFieldValues(asset, fieldNames) {
    const values = new Set();
    if (asset.fields && Array.isArray(asset.fields)) {
        asset.fields.forEach(field => {
            if (field.value && fieldNames.some(name => 
                field.label?.toLowerCase().includes(name.toLowerCase())
            )) {
                values.add(field.value.toString().toLowerCase().trim());
            }
        });
    }
    return Array.from(values);
}

// Helper function to check if asset is user-related
function isUserAsset(assetType) {
    const userTypes = ['computer', 'laptop', 'workstation', 'desktop', 'pc', 
                       'phone', 'mobile', 'cellular', 'extension',
                       'email', 'mailbox', 'mail', 
                       'license', 'subscription', 'software',
                       'printer', 'print', 'scanner',
                       'password', 'credential', 'account'];
    return userTypes.some(type => assetType.toLowerCase().includes(type));
}

module.exports = async (req, res) => {
    console.log(`${req.method} request received at ${new Date().toISOString()}`);
    
    // Handle test endpoint
    if (req.method === 'GET') {
        // Debug endpoint for testing specific features
        if (req.query.debug) {
            try {
                const debugInfo = {
                    timestamp: new Date().toISOString(),
                    env: {
                        hasApiKey: !!HUDU_API_KEY,
                        hasBaseUrl: !!HUDU_BASE_URL,
                        baseUrl: HUDU_BASE_URL ? HUDU_BASE_URL.replace(/https?:\/\//, '***://') : null
                    }
                };
                
                // Test relations endpoint if asset_id provided
                if (req.query.asset_id && HUDU_API_KEY && HUDU_BASE_URL) {
                    const assetId = req.query.asset_id;
                    
                    // Get asset details
                    const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${assetId}`, {
                        headers: { 'x-api-key': HUDU_API_KEY }
                    });
                    
                    // Get all relations
                    const relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                        headers: { 'x-api-key': HUDU_API_KEY },
                        params: { page_size: 250 }
                    });
                    
                    const allRelations = relationsResponse.data?.relations || [];
                    const assetRelations = allRelations.filter(r => 
                        (r.fromable_type === 'Asset' && r.fromable_id == assetId) ||
                        (r.toable_type === 'Asset' && r.toable_id == assetId)
                    );
                    
                    debugInfo.asset = {
                        id: assetResponse.data?.asset?.id,
                        name: assetResponse.data?.asset?.name,
                        type: assetResponse.data?.asset?.asset_type,
                        company_id: assetResponse.data?.asset?.company_id
                    };
                    debugInfo.relations = {
                        total: allRelations.length,
                        forThisAsset: assetRelations.length,
                        sample: assetRelations.slice(0, 3)
                    };
                }
                
                res.status(200).json(debugInfo);
                return;
            } catch (error) {
                res.status(200).json({ 
                    error: error.message,
                    stack: error.stack?.split('\n').slice(0, 3)
                });
                return;
            }
        }
        
        // Default GET response
        const testResponse = {
            "message": `<div style='padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; text-align: center;'>
                <h3>✅ BoldDesk-Hudu Integration Active</h3>
                <p>Enhanced Version 2.0 - ${new Date().toLocaleString()}</p>
                <p style='font-size: 11px; opacity: 0.9;'>Features: Relations API, Smart Matching, Multi-field Search</p>
            </div>`,
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
        return;
    }
    
    // Main POST handler
    if (req.method === 'POST') {
        try {
            // Extract email from various possible locations
            let email = req.body.requester?.EmailId ||
                       req.body.requester?.email ||
                       req.body.customer?.EmailId ||
                       req.body.customer?.email ||
                       req.body.EmailId ||
                       req.body.email ||
                       null;
            
            console.log('Processing request for email:', email);
            
            if (!email || !HUDU_API_KEY || !HUDU_BASE_URL) {
                const missing = [];
                if (!email) missing.push('Email');
                if (!HUDU_API_KEY) missing.push('API Key');
                if (!HUDU_BASE_URL) missing.push('Base URL');
                
                res.status(200).json({
                    "message": `<div style='color: #ef4444; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                        <strong>⚠️ חסרים נתונים:</strong> ${missing.join(', ')}
                    </div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            // Step 1: Find customer asset
            console.log('Step 1: Searching for customer with email:', email);
            const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { 
                    search: email, 
                    page_size: 50 
                }
            });
            
            const allAssets = searchResponse.data?.assets || [];
            console.log(`Found ${allAssets.length} assets in search`);
            
            // Find customer asset - improved logic
            const customerAsset = allAssets.find(asset => {
                const assetType = (asset.asset_type || '').toLowerCase();
                const isPerson = assetType.includes('people') || 
                                assetType.includes('person') || 
                                assetType.includes('contact') ||
                                assetType.includes('user') ||
                                assetType.includes('employee');
                
                if (isPerson) return true;
                
                // Check fields for email match
                if (asset.fields && Array.isArray(asset.fields)) {
                    return asset.fields.some(field => {
                        const value = (field.value || '').toString().toLowerCase();
                        return value === email.toLowerCase();
                    });
                }
                
                return false;
            });
            
            if (!customerAsset) {
                console.log('No customer found for email:', email);
                res.status(200).json({
                    "message": `<div style='color: #dc2626; padding: 15px; background: #fee2e2; border-radius: 8px;'>
                        <strong>❌ לא נמצא לקוח</strong><br/>
                        <span style='font-size: 12px;'>לא נמצא פרופיל לקוח עם המייל: ${email}</span>
                    </div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`Found customer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            
            // Step 2: Get detailed customer information
            let detailedCustomer = customerAsset;
            try {
                const detailResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`, {
                    headers: { 'x-api-key': HUDU_API_KEY }
                });
                if (detailResponse.data?.asset) {
                    detailedCustomer = detailResponse.data.asset;
                    console.log('Retrieved detailed customer data');
                }
            } catch (error) {
                console.log('Could not get detailed customer data:', error.message);
            }
            
            // Extract customer identifiers for matching
            const customerName = detailedCustomer.name.toLowerCase().trim();
            const nameParts = customerName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts[nameParts.length - 1];
            const customerEmails = extractFieldValues(detailedCustomer, ['email', 'mail', 'דוא"ל']);
            const customerPhones = extractFieldValues(detailedCustomer, ['phone', 'mobile', 'טלפון', 'נייד']);
            
            console.log('Customer identifiers:', {
                name: customerName,
                firstName,
                lastName,
                emails: customerEmails,
                phones: customerPhones
            });
            
            // Step 3: Find related assets using multiple methods
            let relatedAssets = [];
            let searchMethods = [];
            
            // Method 1: Try Relations API
            try {
                console.log('Method 1: Checking Relations API...');
                const relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                    headers: { 'x-api-key': HUDU_API_KEY },
                    params: { page_size: 250 }
                });
                
                const allRelations = relationsResponse.data?.relations || [];
                console.log(`Relations API returned ${allRelations.length} total relations`);
                
                // Find relations for this customer
                const customerRelations = allRelations.filter(relation => {
                    return (relation.fromable_type === 'Asset' && relation.fromable_id == customerAsset.id) ||
                           (relation.toable_type === 'Asset' && relation.toable_id == customerAsset.id);
                });
                
                console.log(`Found ${customerRelations.length} relations for customer`);
                
                // Get details for each related asset
                for (const relation of customerRelations) {
                    try {
                        let relatedAssetId = null;
                        
                        if (relation.fromable_type === 'Asset' && relation.fromable_id == customerAsset.id) {
                            if (relation.toable_type === 'Asset') {
                                relatedAssetId = relation.toable_id;
                            }
                        } else if (relation.toable_type === 'Asset' && relation.toable_id == customerAsset.id) {
                            if (relation.fromable_type === 'Asset') {
                                relatedAssetId = relation.fromable_id;
                            }
                        }
                        
                        if (relatedAssetId && relatedAssetId != customerAsset.id) {
                            const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedAssetId}`, {
                                headers: { 'x-api-key': HUDU_API_KEY }
                            });
                            
                            if (assetResponse.data?.asset) {
                                const asset = assetResponse.data.asset;
                                // Don't add if it's another person/contact
                                const assetType = (asset.asset_type || '').toLowerCase();
                                if (!assetType.includes('people') && !assetType.includes('person') && !assetType.includes('contact')) {
                                    asset.match_method = 'Relations API';
                                    asset.match_reason = relation.description || 'Linked Asset';
                                    asset.confidence = 'high';
                                    relatedAssets.push(asset);
                                    console.log(`Added related asset: ${asset.name}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.log('Error fetching related asset:', error.message);
                    }
                }
                
                if (relatedAssets.length > 0) {
                    searchMethods.push('Relations API');
                }
            } catch (error) {
                console.log('Relations API error:', error.message);
            }
            
            // Method 2: Smart matching within company
            try {
                console.log('Method 2: Smart matching in company assets...');
                
                // Get all company assets
                const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${detailedCustomer.company_id}/assets`, {
                    headers: { 'x-api-key': HUDU_API_KEY },
                    params: { 
                        page_size: 250,
                        archived: false
                    }
                });
                
                const companyAssets = companyResponse.data?.assets || [];
                console.log(`Found ${companyAssets.length} assets in company`);
                
                // Filter and score assets
                const scoredAssets = companyAssets.map(asset => {
                    // Skip if it's the customer asset itself
                    if (asset.id == customerAsset.id) return null;
                    
                    // Skip if it's another person
                    const assetType = (asset.asset_type || '').toLowerCase();
                    if (assetType.includes('people') || assetType.includes('person') || assetType.includes('contact')) {
                        return null;
                    }
                    
                    let score = 0;
                    let reasons = [];
                    
                    const assetName = (asset.name || '').toLowerCase();
                    
                    // Check name matching
                    if (firstName && firstName.length > 2) {
                        if (assetName.includes(firstName)) {
                            score += 10;
                            reasons.push(`שם פרטי: "${firstName}"`);
                        }
                    }
                    
                    if (lastName && lastName.length > 2) {
                        if (assetName.includes(lastName)) {
                            score += 10;
                            reasons.push(`שם משפחה: "${lastName}"`);
                        }
                    }
                    
                    if (assetName === customerName) {
                        score += 15;
                        reasons.push('התאמה מלאה לשם');
                    }
                    
                    // Check fields for matches
                    if (asset.fields && Array.isArray(asset.fields)) {
                        asset.fields.forEach(field => {
                            const fieldValue = (field.value || '').toString().toLowerCase();
                            
                            // Check for email matches
                            customerEmails.forEach(email => {
                                if (fieldValue.includes(email)) {
                                    score += 12;
                                    reasons.push(`Email ב-${field.label}`);
                                }
                            });
                            
                            // Check for phone matches
                            customerPhones.forEach(phone => {
                                if (fieldValue.includes(phone)) {
                                    score += 8;
                                    reasons.push(`טלפון ב-${field.label}`);
                                }
                            });
                            
                            // Check for name in fields
                            if (firstName && firstName.length > 2 && fieldValue.includes(firstName)) {
                                score += 5;
                                reasons.push(`"${firstName}" ב-${field.label}`);
                            }
                            
                            if (lastName && lastName.length > 2 && fieldValue.includes(lastName)) {
                                score += 5;
                                reasons.push(`"${lastName}" ב-${field.label}`);
                            }
                            
                            // Check for customer ID reference
                            if (fieldValue.includes(customerAsset.id.toString())) {
                                score += 15;
                                reasons.push(`Customer ID ב-${field.label}`);
                            }
                        });
                    }
                    
                    // Bonus for user-type assets in small companies
                    if (isUserAsset(assetType) && companyAssets.length <= 20) {
                        score += 3;
                        reasons.push('נכס משתמש - חברה קטנה');
                    }
                    
                    // Only include if score is significant
                    if (score > 0) {
                        return {
                            ...asset,
                            match_score: score,
                            match_method: 'Smart Match',
                            match_reason: reasons[0] || 'Match found',
                            all_reasons: reasons,
                            confidence: score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low'
                        };
                    }
                    
                    return null;
                }).filter(Boolean);
                
                // Sort by score and take best matches
                scoredAssets.sort((a, b) => b.match_score - a.match_score);
                
                // Add to results if not already there
                scoredAssets.forEach(asset => {
                    if (!relatedAssets.find(a => a.id == asset.id)) {
                        relatedAssets.push(asset);
                        console.log(`Smart match: ${asset.name} (score: ${asset.match_score})`);
                    }
                });
                
                if (scoredAssets.length > 0) {
                    searchMethods.push('Smart Match');
                }
                
            } catch (error) {
                console.log('Smart matching error:', error.message);
            }
            
            // Method 3: Search by customer name
            if (relatedAssets.length < 3) {
                try {
                    console.log('Method 3: Searching by customer name...');
                    const nameSearchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                        headers: { 'x-api-key': HUDU_API_KEY },
                        params: { 
                            search: customerName,
                            page_size: 25,
                            company_id: detailedCustomer.company_id
                        }
                    });
                    
                    const nameAssets = nameSearchResponse.data?.assets || [];
                    nameAssets.forEach(asset => {
                        if (asset.id != customerAsset.id && 
                            !relatedAssets.find(a => a.id == asset.id)) {
                            const assetType = (asset.asset_type || '').toLowerCase();
                            if (!assetType.includes('people') && !assetType.includes('person')) {
                                asset.match_method = 'Name Search';
                                asset.match_reason = 'שם תואם';
                                asset.confidence = 'medium';
                                relatedAssets.push(asset);
                            }
                        }
                    });
                    
                    if (nameAssets.length > 0) {
                        searchMethods.push('Name Search');
                    }
                } catch (error) {
                    console.log('Name search error:', error.message);
                }
            }
            
            console.log(`Total related assets found: ${relatedAssets.length}`);
            console.log(`Search methods used: ${searchMethods.join(', ')}`);
            
            // Step 4: Generate HTML response
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
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        }
                        .company-badge {
                            background: rgba(255,255,255,0.2);
                            padding: 4px 10px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: 500;
                        }
                        .search-info {
                            font-size: 11px;
                            opacity: 0.9;
                            margin-top: 5px;
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
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                            gap: 10px;
                            font-size: 12px;
                        }
                        .info-item {
                            padding: 8px;
                            background: #f8f9fa;
                            border-radius: 6px;
                            border: 1px solid #e9ecef;
                        }
                        .info-label {
                            color: #6c757d;
                            font-size: 10px;
                            font-weight: 600;
                            margin-bottom: 3px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .info-value {
                            color: #212529;
                            font-weight: 500;
                            word-break: break-word;
                        }
                        .assets-section h3 {
                            font-size: 14px;
                            color: #212529;
                            margin: 0 0 12px 0;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        }
                        .count-badge {
                            background: #667eea;
                            color: white;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 11px;
                            font-weight: 600;
                        }
                        .methods-badge {
                            background: #e9ecef;
                            color: #495057;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-size: 10px;
                            font-weight: 500;
                        }
                        .asset-item {
                            background: white;
                            border-radius: 8px;
                            margin: 10px 0;
                            border: 1px solid #dee2e6;
                            overflow: hidden;
                            transition: all 0.2s;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                        }
                        .asset-item:hover {
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                            transform: translateY(-1px);
                        }
                        .asset-header {
                            padding: 12px;
                            background: #f8f9fa;
                            cursor: pointer;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            border-bottom: 1px solid #e9ecef;
                        }
                        .asset-header:hover {
                            background: #e9ecef;
                        }
                        .asset-title {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            flex: 1;
                        }
                        .asset-icon {
                            font-size: 20px;
                        }
                        .asset-name {
                            font-size: 13px;
                            font-weight: 600;
                            color: #212529;
                            margin-bottom: 3px;
                        }
                        .asset-meta {
                            display: flex;
                            gap: 6px;
                            margin-top: 3px;
                            flex-wrap: wrap;
                        }
                        .asset-type {
                            background: #0ea5e9;
                            color: white;
                            padding: 2px 6px;
                            border-radius: 10px;
                            font-size: 9px;
                            font-weight: 600;
                            text-transform: uppercase;
                        }
                        .match-method {
                            background: #8b5cf6;
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
                            border-radius: 10px;
                            font-size: 9px;
                            font-weight: 600;
                        }
                        .confidence-medium {
                            background: #f59e0b;
                            color: white;
                            padding: 2px 6px;
                            border-radius: 10px;
                            font-size: 9px;
                            font-weight: 600;
                        }
                        .confidence-low {
                            background: #6b7280;
                            color: white;
                            padding: 2px 6px;
                            border-radius: 10px;
                            font-size: 9px;
                            font-weight: 600;
                        }
                        .asset-details {
                            display: none;
                            padding: 12px;
                            background: #fafbfc;
                            border-top: 1px solid #e9ecef;
                        }
                        .asset-details.show {
                            display: block;
                        }
                        .detail-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                            gap: 8px;
                            font-size: 11px;
                        }
                        .detail-item {
                            padding: 8px;
                            background: white;
                            border-radius: 6px;
                            border: 1px solid #e9ecef;
                        }
                        .detail-label {
                            color: #6c757d;
                            font-size: 9px;
                            font-weight: 600;
                            margin-bottom: 3px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .detail-value {
                            color: #212529;
                            font-weight: 500;
                            word-break: break-word;
                        }
                        .hudu-link {
                            display: inline-block;
                            background: #667eea;
                            color: white;
                            text-decoration: none;
                            padding: 8px 12px;
                            border-radius: 6px;
                            font-size: 11px;
                            font-weight: 600;
                            margin-top: 10px;
                            transition: all 0.2s;
                        }
                        .hudu-link:hover {
                            background: #5a67d8;
                            transform: translateY(-1px);
                        }
                        .no-assets {
                            text-align: center;
                            padding: 30px;
                            color: #6c757d;
                            background: white;
                            border-radius: 8px;
                            border: 2px dashed #dee2e6;
                        }
                        .expand-icon {
                            font-size: 14px;
                            color: #6c757d;
                            transition: transform 0.2s;
                        }
                        .expand-icon.rotated {
                            transform: rotate(180deg);
                        }
                    </style>
                    
                    <!-- Header -->
                    <div class='header'>
                        <div class='customer-name'>
                            <span>👤 ${detailedCustomer.name}</span>
                            <span class='company-badge'>${detailedCustomer.company_name || 'Unknown Company'}</span>
                        </div>
                        <div class='search-info'>
                            Methods: ${searchMethods.length > 0 ? searchMethods.join(' + ') : 'None'} | 
                            Found: ${relatedAssets.length} assets
                        </div>
                    </div>
                    
                    <div class='content'>
                        <!-- Customer Info -->
                        <div class='customer-info'>
                            <div class='info-grid'>
                                ${detailedCustomer.fields?.filter(f => f.value && f.value.toString().trim()).slice(0, 6).map(field => `
                                    <div class='info-item'>
                                        <div class='info-label'>${field.label || 'Field'}</div>
                                        <div class='info-value'>${field.value || 'N/A'}</div>
                                    </div>
                                `).join('') || '<div style="grid-column: 1 / -1; text-align: center; color: #6c757d; font-size: 12px;">אין מידע נוסף זמין</div>'}
                            </div>
                        </div>
                        
                        <!-- Related Assets -->
                        <div class='assets-section'>
                            <h3>
                                🔗 נכסים קשורים
                                <span class='count-badge'>${relatedAssets.length}</span>
                                ${searchMethods.length > 0 ? `<span class='methods-badge'>${searchMethods.join(' + ')}</span>` : ''}
                            </h3>
                            
                            ${relatedAssets.length > 0 ? relatedAssets.map((item, index) => {
                                let icon = '📄';
                                const type = item.asset_type || 'Other';
                                const typeLower = type.toLowerCase();
                                
                                // Icon selection based on asset type
                                if (typeLower.includes('computer') || typeLower.includes('laptop') || typeLower.includes('desktop') || typeLower.includes('workstation')) icon = '💻';
                                else if (typeLower.includes('phone') || typeLower.includes('mobile')) icon = '📱';
                                else if (typeLower.includes('printer') || typeLower.includes('print')) icon = '🖨️';
                                else if (typeLower.includes('password') || typeLower.includes('credential')) icon = '🔐';
                                else if (typeLower.includes('license') || typeLower.includes('subscription')) icon = '🔑';
                                else if (typeLower.includes('email') || typeLower.includes('mail')) icon = '📧';
                                else if (typeLower.includes('network') || typeLower.includes('switch') || typeLower.includes('router')) icon = '🔌';
                                else if (typeLower.includes('server')) icon = '🖥️';
                                else if (typeLower.includes('sharepoint') || typeLower.includes('onedrive')) icon = '☁️';
                                else if (typeLower.includes('software') || typeLower.includes('application')) icon = '💿';
                                
                                // Build reasons display
                                let reasonsDisplay = item.match_reason || 'Related';
                                if (item.all_reasons && item.all_reasons.length > 1) {
                                    reasonsDisplay = item.all_reasons[0] + ` (+${item.all_reasons.length - 1} more)`;
                                }
                                
                                return `
                                    <div class='asset-item'>
                                        <div class='asset-header' onclick='toggleDetails(this)'>
                                            <div class='asset-title'>
                                                <span class='asset-icon'>${icon}</span>
                                                <div>
                                                    <div class='asset-name'>${item.name || 'Unnamed Asset'}</div>
                                                    <div class='asset-meta'>
                                                        <span class='asset-type'>${type}</span>
                                                        <span class='match-method'>${item.match_method || 'Found'}</span>
                                                        <span class='confidence-${item.confidence || 'medium'}'>${reasonsDisplay}</span>
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
                                                    <div class='detail-label'>Type</div>
                                                    <div class='detail-value'>${item.asset_type || 'N/A'}</div>
                                                </div>
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Method</div>
                                                    <div class='detail-value'>${item.match_method || 'N/A'}</div>
                                                </div>
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Confidence</div>
                                                    <div class='detail-value'>${item.confidence || 'N/A'}</div>
                                                </div>
                                                ${item.match_score ? `
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Match Score</div>
                                                    <div class='detail-value'>${item.match_score}</div>
                                                </div>
                                                ` : ''}
                                                ${item.all_reasons && item.all_reasons.length > 0 ? `
                                                <div class='detail-item' style='grid-column: 1 / -1;'>
                                                    <div class='detail-label'>All Match Reasons</div>
                                                    <div class='detail-value'>${item.all_reasons.join(' • ')}</div>
                                                </div>
                                                ` : ''}
                                                ${item.primary_serial ? `
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Serial</div>
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
                                            <a href='${item.url || `${HUDU_BASE_URL}/a/${item.company_id}/assets/${item.id}`}' target='_blank' class='hudu-link'>
                                                🔗 פתח ב-Hudu
                                            </a>
                                        </div>
                                    </div>
                                `;
                            }).join('') : `
                                <div class='no-assets'>
                                    <div style='font-size: 32px; margin-bottom: 10px;'>🔍</div>
                                    <div style='font-size: 14px; font-weight: 600; margin-bottom: 5px;'>לא נמצאו נכסים קשורים</div>
                                    <div style='font-size: 12px;'>לא נמצאו נכסים המקושרים ל-${detailedCustomer.name}</div>
                                    <div style='font-size: 11px; margin-top: 10px; color: #adb5bd;'>
                                        Methods tried: ${searchMethods.length > 0 ? searchMethods.join(', ') : 'All available'}
                                    </div>
                                </div>
                            `}
                        </div>
                        
                        <!-- Footer -->
                        <div style='text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;'>
                            <a href='${detailedCustomer.url || `${HUDU_BASE_URL}/a/${detailedCustomer.company_id}/assets/${detailedCustomer.id}`}' target='_blank' class='hudu-link' style='margin-right: 10px;'>
                                👤 פרופיל לקוח
                            </a>
                            <a href='${HUDU_BASE_URL}/a/${detailedCustomer.company_id}/assets' target='_blank' class='hudu-link'>
                                🏢 כל נכסי החברה
                            </a>
                        </div>
                    </div>
                    
                    <script>
                        function toggleDetails(header) {
                            const details = header.nextElementSibling;
                            const arrow = header.querySelector('.expand-icon');
                            
                            if (details.classList.contains('show')) {
                                details.classList.remove('show');
                                arrow.classList.remove('rotated');
                                arrow.textContent = '▼';
                            } else {
                                // Close all other open details
                                document.querySelectorAll('.asset-details.show').forEach(d => {
                                    d.classList.remove('show');
                                    d.previousElementSibling.querySelector('.expand-icon').classList.remove('rotated');
                                    d.previousElementSibling.querySelector('.expand-icon').textContent = '▼';
                                });
                                
                                details.classList.add('show');
                                arrow.classList.add('rotated');
                                arrow.textContent = '▲';
                            }
                        }
                    </script>
                </div>
            `;
            
            // Send response
            const response = {
                "message": htmlMessage,
                "statusCode": "200"
            };
            
            console.log(`Response sent successfully with ${relatedAssets.length} related assets`);
            res.status(200).json(response);
            
        } catch (error) {
            console.error('Error in main handler:', error);
            const errorMessage = `
                <div style='background: #fee2e2; color: #dc2626; padding: 15px; border-radius: 8px; border: 1px solid #fca5a5;'>
                    <strong>❌ שגיאה בעיבוד הבקשה</strong><br/>
                    <span style='font-size: 12px;'>${error.message}</span><br/>
                    <span style='font-size: 10px; color: #7f1d1d;'>Stack: ${error.stack?.split('\n')[0]}</span>
                </div>
            `;
            
            res.status(200).json({
                "message": errorMessage,
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
