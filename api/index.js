// Fixed Hudu-BoldDesk Integration - Properly handles Relations
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Helper function to check if asset is user-related
function isUserAsset(assetType) {
    const userTypes = ['computer', 'laptop', 'workstation', 'desktop', 'pc', 
                       'phone', 'mobile', 'cellular', 'extension',
                       'email', 'mailbox', 'mail', '365',
                       'license', 'subscription', 'software',
                       'printer', 'print', 'scanner',
                       'password', 'credential', 'account',
                       'process', 'processes'];
    return userTypes.some(type => assetType.toLowerCase().includes(type));
}

module.exports = async (req, res) => {
    console.log(`${req.method} request received at ${new Date().toISOString()}`);
    
    // Handle GET requests for testing
    if (req.method === 'GET') {
        // Debug endpoint for testing relations
        if (req.query.test_relations && req.query.asset_id) {
            try {
                const assetId = req.query.asset_id;
                
                // Method 1: Try direct asset endpoint with relations
                const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${assetId}`, {
                    headers: { 'x-api-key': HUDU_API_KEY }
                });
                
                const asset = assetResponse.data?.asset;
                
                // Method 2: Try relations endpoint
                const relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                    headers: { 'x-api-key': HUDU_API_KEY },
                    params: { page_size: 250 }
                });
                
                const allRelations = relationsResponse.data?.relations || [];
                const assetRelations = allRelations.filter(r => 
                    (r.fromable_type === 'Asset' && r.fromable_id == assetId) ||
                    (r.toable_type === 'Asset' && r.toable_id == assetId)
                );
                
                // Method 3: Try asset_relations endpoint (if exists)
                let directRelations = null;
                try {
                    const directRelResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${assetId}/relations`, {
                        headers: { 'x-api-key': HUDU_API_KEY }
                    });
                    directRelations = directRelResponse.data;
                } catch (e) {
                    console.log('Direct relations endpoint not available');
                }
                
                res.json({
                    asset: {
                        id: asset?.id,
                        name: asset?.name,
                        type: asset?.asset_type,
                        related_items: asset?.related_items || asset?.relations || 'Not in response'
                    },
                    relations_api: {
                        total: allRelations.length,
                        filtered: assetRelations.length,
                        sample: assetRelations.slice(0, 3)
                    },
                    direct_relations: directRelations,
                    raw_asset_keys: Object.keys(asset || {})
                });
                return;
            } catch (error) {
                res.json({ error: error.message });
                return;
            }
        }
        
        // Default GET response
        res.status(200).json({
            "message": `<div style='padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;'>
                <h3>✅ Hudu-BoldDesk Integration v3.0</h3>
                <p>Fixed Relations + Smart Match</p>
                <p style='font-size: 11px;'>Test relations: GET ?test_relations=1&asset_id=ID</p>
            </div>`,
            "statusCode": "200"
        });
        return;
    }
    
    // Main POST handler
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
            
            console.log('Processing request for email:', email);
            
            if (!email || !HUDU_API_KEY || !HUDU_BASE_URL) {
                res.status(200).json({
                    "message": `<div style='color: #ef4444; padding: 15px;'>⚠️ Missing: ${!email ? 'Email' : ''} ${!HUDU_API_KEY ? 'API Key' : ''} ${!HUDU_BASE_URL ? 'Base URL' : ''}</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            // Step 1: Find customer asset
            console.log('Searching for customer...');
            const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { search: email, page_size: 50 }
            });
            
            const allAssets = searchResponse.data?.assets || [];
            const customerAsset = allAssets.find(asset => {
                const assetType = (asset.asset_type || '').toLowerCase();
                return assetType.includes('people') || 
                       assetType.includes('person') || 
                       assetType.includes('contact') ||
                       assetType.includes('user') ||
                       (asset.fields?.some(f => f.value?.toString().toLowerCase() === email.toLowerCase()));
            });
            
            if (!customerAsset) {
                res.status(200).json({
                    "message": `<div style='color: #dc2626; padding: 15px;'>❌ לא נמצא לקוח עם המייל: ${email}</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`Found customer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            
            // Step 2: Get detailed customer with relations
            let detailedCustomer = customerAsset;
            let embeddedRelations = [];
            
            try {
                const detailResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`, {
                    headers: { 'x-api-key': HUDU_API_KEY }
                });
                
                if (detailResponse.data?.asset) {
                    detailedCustomer = detailResponse.data.asset;
                    
                    // Check for embedded relations in the response
                    if (detailedCustomer.relations) {
                        embeddedRelations = detailedCustomer.relations;
                        console.log(`Found ${embeddedRelations.length} embedded relations`);
                    }
                    
                    // Check for related_items (alternative format)
                    if (detailedCustomer.related_items && Array.isArray(detailedCustomer.related_items)) {
                        embeddedRelations = detailedCustomer.related_items;
                        console.log(`Found ${embeddedRelations.length} related items`);
                    }
                }
            } catch (error) {
                console.log('Error getting detailed customer:', error.message);
            }
            
            // Step 3: Collect all related assets
            let relatedAssets = [];
            let searchMethods = [];
            
            // Method 1: Process embedded relations/related_items
            if (embeddedRelations.length > 0) {
                console.log('Processing embedded relations...');
                searchMethods.push('Embedded Relations');
                
                for (const relation of embeddedRelations) {
                    try {
                        // Handle different relation formats
                        let relatedAssetId = null;
                        let relationType = 'Related';
                        
                        if (relation.id) {
                            relatedAssetId = relation.id;
                            relationType = relation.type || relation.asset_type || 'Related';
                        } else if (relation.asset_id) {
                            relatedAssetId = relation.asset_id;
                            relationType = relation.asset_type || 'Related';
                        } else if (relation.toable_id && relation.toable_type === 'Asset') {
                            relatedAssetId = relation.toable_id;
                            relationType = relation.description || 'Related';
                        } else if (relation.fromable_id && relation.fromable_type === 'Asset') {
                            relatedAssetId = relation.fromable_id;
                            relationType = relation.description || 'Related';
                        }
                        
                        if (relatedAssetId && relatedAssetId != customerAsset.id) {
                            // Get full asset details
                            const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedAssetId}`, {
                                headers: { 'x-api-key': HUDU_API_KEY }
                            });
                            
                            if (assetResponse.data?.asset) {
                                const asset = assetResponse.data.asset;
                                asset.match_method = 'Direct Relation';
                                asset.match_reason = relationType;
                                asset.confidence = 'high';
                                relatedAssets.push(asset);
                                console.log(`Added related asset: ${asset.name} (${asset.asset_type})`);
                            }
                        }
                    } catch (error) {
                        console.log('Error processing relation:', error.message);
                    }
                }
            }
            
            // Method 2: Try Relations API
            try {
                console.log('Checking Relations API...');
                const relationsResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/relations`, {
                    headers: { 'x-api-key': HUDU_API_KEY },
                    params: { page_size: 250 }
                });
                
                const allRelations = relationsResponse.data?.relations || [];
                const customerRelations = allRelations.filter(relation => 
                    (relation.fromable_type === 'Asset' && relation.fromable_id == customerAsset.id) ||
                    (relation.toable_type === 'Asset' && relation.toable_id == customerAsset.id)
                );
                
                console.log(`Found ${customerRelations.length} relations in Relations API`);
                
                for (const relation of customerRelations) {
                    try {
                        let relatedAssetId = null;
                        
                        if (relation.fromable_type === 'Asset' && relation.fromable_id == customerAsset.id && relation.toable_type === 'Asset') {
                            relatedAssetId = relation.toable_id;
                        } else if (relation.toable_type === 'Asset' && relation.toable_id == customerAsset.id && relation.fromable_type === 'Asset') {
                            relatedAssetId = relation.fromable_id;
                        }
                        
                        if (relatedAssetId && !relatedAssets.find(a => a.id == relatedAssetId)) {
                            const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedAssetId}`, {
                                headers: { 'x-api-key': HUDU_API_KEY }
                            });
                            
                            if (assetResponse.data?.asset) {
                                const asset = assetResponse.data.asset;
                                const assetType = (asset.asset_type || '').toLowerCase();
                                if (!assetType.includes('people') && !assetType.includes('person')) {
                                    asset.match_method = 'Relations API';
                                    asset.match_reason = relation.description || 'Linked';
                                    asset.confidence = 'high';
                                    relatedAssets.push(asset);
                                    console.log(`Added from Relations API: ${asset.name}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.log('Error fetching relation asset:', error.message);
                    }
                }
                
                if (customerRelations.length > 0) {
                    searchMethods.push('Relations API');
                }
            } catch (error) {
                console.log('Relations API error:', error.message);
            }
            
            // Method 3: Smart matching in company
            if (relatedAssets.length < 10) {  // Only if we need more results
                try {
                    console.log('Running smart matching...');
                    const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${detailedCustomer.company_id}/assets`, {
                        headers: { 'x-api-key': HUDU_API_KEY },
                        params: { page_size: 250, archived: false }
                    });
                    
                    const companyAssets = companyResponse.data?.assets || [];
                    console.log(`Scanning ${companyAssets.length} company assets...`);
                    
                    const customerName = detailedCustomer.name.toLowerCase().trim();
                    const nameParts = customerName.split(/\s+/);
                    const firstName = nameParts[0];
                    const lastName = nameParts[nameParts.length - 1];
                    
                    const smartMatches = companyAssets.filter(asset => {
                        // Skip already found assets
                        if (asset.id == customerAsset.id || relatedAssets.find(a => a.id == asset.id)) {
                            return false;
                        }
                        
                        // Skip other people
                        const assetType = (asset.asset_type || '').toLowerCase();
                        if (assetType.includes('people') || assetType.includes('person') || assetType.includes('contact')) {
                            return false;
                        }
                        
                        const assetName = (asset.name || '').toLowerCase();
                        
                        // Strong name match
                        if (customerName && assetName.includes(customerName)) {
                            asset.match_method = 'Smart Match';
                            asset.match_reason = 'Full name match';
                            asset.confidence = 'high';
                            return true;
                        }
                        
                        // Partial name match
                        if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                            asset.match_method = 'Smart Match';
                            asset.match_reason = `Name contains "${firstName}"`;
                            asset.confidence = 'medium';
                            return true;
                        }
                        
                        if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                            asset.match_method = 'Smart Match';
                            asset.match_reason = `Name contains "${lastName}"`;
                            asset.confidence = 'medium';
                            return true;
                        }
                        
                        // Check fields for email/name match
                        if (asset.fields && Array.isArray(asset.fields)) {
                            for (const field of asset.fields) {
                                const fieldValue = (field.value || '').toString().toLowerCase();
                                
                                if (email && fieldValue.includes(email.toLowerCase())) {
                                    asset.match_method = 'Smart Match';
                                    asset.match_reason = `Email in ${field.label}`;
                                    asset.confidence = 'high';
                                    return true;
                                }
                                
                                if (customerName && fieldValue.includes(customerName)) {
                                    asset.match_method = 'Smart Match';
                                    asset.match_reason = `Name in ${field.label}`;
                                    asset.confidence = 'high';
                                    return true;
                                }
                            }
                        }
                        
                        // User assets in small companies
                        if (isUserAsset(assetType) && companyAssets.length <= 15) {
                            asset.match_method = 'Smart Match';
                            asset.match_reason = 'User asset - small company';
                            asset.confidence = 'low';
                            return true;
                        }
                        
                        return false;
                    });
                    
                    // Add smart matches
                    smartMatches.forEach(asset => {
                        if (!relatedAssets.find(a => a.id == asset.id)) {
                            relatedAssets.push(asset);
                            console.log(`Smart match: ${asset.name} - ${asset.match_reason}`);
                        }
                    });
                    
                    if (smartMatches.length > 0) {
                        searchMethods.push('Smart Match');
                    }
                } catch (error) {
                    console.log('Smart matching error:', error.message);
                }
            }
            
            // Method 4: Name search
            if (relatedAssets.length < 5) {
                try {
                    console.log('Trying name search...');
                    const nameSearchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                        headers: { 'x-api-key': HUDU_API_KEY },
                        params: { 
                            search: detailedCustomer.name.split(' ')[0],  // First name only
                            page_size: 25,
                            company_id: detailedCustomer.company_id
                        }
                    });
                    
                    const nameAssets = nameSearchResponse.data?.assets || [];
                    nameAssets.forEach(asset => {
                        if (asset.id != customerAsset.id && !relatedAssets.find(a => a.id == asset.id)) {
                            const assetType = (asset.asset_type || '').toLowerCase();
                            if (!assetType.includes('people') && !assetType.includes('person')) {
                                asset.match_method = 'Name Search';
                                asset.match_reason = 'Name match';
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
            
            console.log(`Final results: ${relatedAssets.length} related assets found`);
            console.log(`Methods used: ${searchMethods.join(', ')}`);
            
            // Generate HTML response
            const htmlMessage = `
                <div style='font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px;'>
                    <style>
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px; }
                        .customer-name { font-size: 18px; font-weight: 600; margin: 0 0 5px 0; display: flex; align-items: center; justify-content: space-between; }
                        .company-badge { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 12px; font-size: 12px; }
                        .content { padding: 15px; background: #f8f9fa; border-radius: 0 0 8px 8px; margin: 0 -10px -10px -10px; }
                        .customer-info { background: white; border-radius: 8px; padding: 12px; margin-bottom: 15px; border: 1px solid #e2e8f0; }
                        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
                        .info-item { padding: 8px; background: #f8f9fa; border-radius: 6px; }
                        .info-label { color: #6c757d; font-size: 10px; font-weight: 600; margin-bottom: 3px; text-transform: uppercase; }
                        .info-value { color: #212529; font-weight: 500; word-break: break-word; }
                        .assets-section h3 { font-size: 14px; color: #212529; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
                        .count-badge { background: #667eea; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
                        .asset-item { background: white; border-radius: 8px; margin: 10px 0; border: 1px solid #dee2e6; overflow: hidden; transition: all 0.2s; }
                        .asset-item:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.1); transform: translateY(-1px); }
                        .asset-header { padding: 12px; background: #f8f9fa; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
                        .asset-title { display: flex; align-items: center; gap: 10px; flex: 1; }
                        .asset-icon { font-size: 20px; }
                        .asset-name { font-size: 13px; font-weight: 600; color: #212529; }
                        .asset-meta { display: flex; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
                        .asset-type { background: #0ea5e9; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }
                        .match-method { background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px; }
                        .confidence-high { background: #10b981; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px; }
                        .confidence-medium { background: #f59e0b; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px; }
                        .confidence-low { background: #6b7280; color: white; padding: 2px 6px; border-radius: 10px; font-size: 9px; }
                        .asset-details { display: none; padding: 12px; background: #fafbfc; }
                        .asset-details.show { display: block; }
                        .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
                        .detail-item { padding: 8px; background: white; border-radius: 6px; border: 1px solid #e9ecef; }
                        .detail-label { color: #6c757d; font-size: 9px; font-weight: 600; margin-bottom: 3px; text-transform: uppercase; }
                        .detail-value { color: #212529; font-weight: 500; word-break: break-word; font-size: 11px; }
                        .hudu-link { display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 10px; }
                        .no-assets { text-align: center; padding: 30px; color: #6c757d; background: white; border-radius: 8px; border: 2px dashed #dee2e6; }
                    </style>
                    
                    <div class='header'>
                        <div class='customer-name'>
                            <span>👤 ${detailedCustomer.name}</span>
                            <span class='company-badge'>${detailedCustomer.company_name || 'Company'}</span>
                        </div>
                        <div style='font-size: 11px; opacity: 0.9; margin-top: 5px;'>
                            Methods: ${searchMethods.join(' + ') || 'None'} | Found: ${relatedAssets.length} items
                        </div>
                    </div>
                    
                    <div class='content'>
                        <div class='customer-info'>
                            <div class='info-grid'>
                                ${detailedCustomer.fields?.filter(f => f.value).slice(0, 4).map(field => `
                                    <div class='info-item'>
                                        <div class='info-label'>${field.label}</div>
                                        <div class='info-value'>${field.value}</div>
                                    </div>
                                `).join('') || '<div>No additional info</div>'}
                            </div>
                        </div>
                        
                        <div class='assets-section'>
                            <h3>
                                🔗 Related Items
                                <span class='count-badge'>${relatedAssets.length}</span>
                            </h3>
                            
                            ${relatedAssets.length > 0 ? relatedAssets.map(item => {
                                let icon = '📄';
                                const type = item.asset_type || 'Other';
                                const typeLower = type.toLowerCase();
                                
                                if (typeLower.includes('computer') || typeLower.includes('laptop')) icon = '💻';
                                else if (typeLower.includes('email') || typeLower.includes('365')) icon = '📧';
                                else if (typeLower.includes('print')) icon = '🖨️';
                                else if (typeLower.includes('password')) icon = '🔐';
                                else if (typeLower.includes('process')) icon = '⚙️';
                                else if (typeLower.includes('phone')) icon = '📱';
                                
                                return `
                                    <div class='asset-item'>
                                        <div class='asset-header' onclick='toggleDetails(this)'>
                                            <div class='asset-title'>
                                                <span class='asset-icon'>${icon}</span>
                                                <div>
                                                    <div class='asset-name'>${item.name}</div>
                                                    <div class='asset-meta'>
                                                        <span class='asset-type'>${type}</span>
                                                        <span class='match-method'>${item.match_method}</span>
                                                        <span class='confidence-${item.confidence}'>${item.match_reason}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span style='color: #6c757d;'>▼</span>
                                        </div>
                                        <div class='asset-details'>
                                            <div class='detail-grid'>
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Asset ID</div>
                                                    <div class='detail-value'>${item.id}</div>
                                                </div>
                                                <div class='detail-item'>
                                                    <div class='detail-label'>Type</div>
                                                    <div class='detail-value'>${item.asset_type}</div>
                                                </div>
                                                ${item.fields?.filter(f => f.value).slice(0, 4).map(field => `
                                                    <div class='detail-item'>
                                                        <div class='detail-label'>${field.label}</div>
                                                        <div class='detail-value'>${field.value}</div>
                                                    </div>
                                                `).join('') || ''}
                                            </div>
                                            <a href='${item.url || `${HUDU_BASE_URL}/a/${item.company_id}/assets/${item.id}`}' target='_blank' class='hudu-link'>
                                                Open in Hudu →
                                            </a>
                                        </div>
                                    </div>
                                `;
                            }).join('') : `
                                <div class='no-assets'>
                                    <div style='font-size: 32px; margin-bottom: 10px;'>🔍</div>
                                    <div style='font-size: 14px; font-weight: 600;'>No related items found</div>
                                    <div style='font-size: 12px; margin-top: 5px;'>Methods tried: ${searchMethods.join(', ') || 'All'}</div>
                                </div>
                            `}
                        </div>
                        
                        <div style='text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;'>
                            <a href='${detailedCustomer.url || `${HUDU_BASE_URL}/a/${detailedCustomer.company_id}/assets/${detailedCustomer.id}`}' target='_blank' class='hudu-link'>
                                View Customer Profile →
                            </a>
                        </div>
                    </div>
                    
                    <script>
                        function toggleDetails(header) {
                            const details = header.nextElementSibling;
                            const arrow = header.querySelector('span:last-child');
                            if (details.classList.contains('show')) {
                                details.classList.remove('show');
                                arrow.textContent = '▼';
                            } else {
                                document.querySelectorAll('.asset-details.show').forEach(d => {
                                    d.classList.remove('show');
                                    d.previousElementSibling.querySelector('span:last-child').textContent = '▼';
                                });
                                details.classList.add('show');
                                arrow.textContent = '▲';
                            }
                        }
                    </script>
