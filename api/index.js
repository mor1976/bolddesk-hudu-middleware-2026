// Debug Version - Hudu-BoldDesk Integration
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    // Debug endpoint - check asset structure
    if (req.method === 'GET' && req.query.debug_asset) {
        try {
            const assetId = req.query.debug_asset;
            
            // Get asset with all details
            const response = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${assetId}`, {
                headers: { 'x-api-key': HUDU_API_KEY }
            });
            
            const asset = response.data?.asset;
            
            // Check for relations in different possible locations
            const debugInfo = {
                asset_id: asset?.id,
                asset_name: asset?.name,
                asset_type: asset?.asset_type,
                
                // Check all possible relation fields
                has_relations: !!asset?.relations,
                relations_count: asset?.relations?.length || 0,
                relations_sample: asset?.relations?.slice(0, 3),
                
                has_related_items: !!asset?.related_items,
                related_items_count: asset?.related_items?.length || 0,
                related_items_sample: asset?.related_items?.slice(0, 3),
                
                has_related_assets: !!asset?.related_assets,
                related_assets_count: asset?.related_assets?.length || 0,
                
                has_associations: !!asset?.associations,
                associations_count: asset?.associations?.length || 0,
                
                // Show all keys in the asset object
                all_keys: Object.keys(asset || {}),
                
                // Check if there are any keys containing 'relat'
                relation_keys: Object.keys(asset || {}).filter(key => 
                    key.toLowerCase().includes('relat') || 
                    key.toLowerCase().includes('assoc') ||
                    key.toLowerCase().includes('link')
                )
            };
            
            res.status(200).json(debugInfo);
            return;
            
        } catch (error) {
            res.status(200).json({ 
                error: error.message,
                hint: 'Use ?debug_asset=ASSET_ID'
            });
            return;
        }
    }
    
    // Test company assets endpoint
    if (req.method === 'GET' && req.query.debug_company) {
        try {
            const companyId = req.query.debug_company;
            const searchName = req.query.name || '';
            
            const response = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${companyId}/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { 
                    page_size: 250,
                    archived: false
                }
            });
            
            const allAssets = response.data?.assets || [];
            
            // Group by asset type
            const assetTypes = {};
            allAssets.forEach(asset => {
                const type = asset.asset_type || 'Unknown';
                if (!assetTypes[type]) {
                    assetTypes[type] = [];
                }
                assetTypes[type].push({
                    id: asset.id,
                    name: asset.name
                });
            });
            
            // If name provided, filter assets
            let matchingAssets = [];
            if (searchName) {
                const searchLower = searchName.toLowerCase();
                matchingAssets = allAssets.filter(asset => {
                    const assetName = (asset.name || '').toLowerCase();
                    
                    // Check name
                    if (assetName.includes(searchLower)) return true;
                    
                    // Check fields
                    if (asset.fields) {
                        for (const field of asset.fields) {
                            const value = (field.value || '').toString().toLowerCase();
                            if (value.includes(searchLower)) return true;
                        }
                    }
                    
                    return false;
                });
            }
            
            res.status(200).json({
                company_id: companyId,
                total_assets: allAssets.length,
                asset_types: assetTypes,
                search_name: searchName,
                matching_assets: matchingAssets.map(a => ({
                    id: a.id,
                    name: a.name,
                    type: a.asset_type
                }))
            });
            return;
            
        } catch (error) {
            res.status(200).json({ 
                error: error.message,
                hint: 'Use ?debug_company=COMPANY_ID&name=SEARCH_NAME'
            });
            return;
        }
    }
    
    // Normal GET test
    if (req.method === 'GET') {
        res.status(200).json({
            "message": `
                <div style='padding: 15px; background: #4f46e5; color: white; border-radius: 8px;'>
                    <h3>🔍 Debug Version Active</h3>
                    <p style='font-size: 12px;'>Debug endpoints:</p>
                    <ul style='font-size: 11px; margin: 5px 0;'>
                        <li>GET ?debug_asset=ASSET_ID - Check asset relations</li>
                        <li>GET ?debug_company=COMPANY_ID&name=NAME - Check company assets</li>
                    </ul>
                </div>
            `,
            "statusCode": "200"
        });
        return;
    }
    
    // Handle POST with extra debugging
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
            
            console.log('=== DEBUG START ===');
            console.log('Email:', email);
            
            if (!email || !HUDU_API_KEY || !HUDU_BASE_URL) {
                res.status(200).json({
                    "message": `<div style='color: red;'>Missing: ${!email ? 'Email' : ''} ${!HUDU_API_KEY ? 'API Key' : ''} ${!HUDU_BASE_URL ? 'Base URL' : ''}</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            // Search for customer
            const searchResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { search: email, page_size: 50 }
            });
            
            const allAssets = searchResponse.data?.assets || [];
            console.log(`Found ${allAssets.length} assets in search`);
            
            // Find customer
            const customerAsset = allAssets.find(asset => {
                const assetType = (asset.asset_type || '').toLowerCase();
                return assetType.includes('people') || 
                       assetType.includes('person') || 
                       assetType.includes('contact');
            });
            
            if (!customerAsset) {
                res.status(200).json({
                    "message": `<div style='color: red;'>לא נמצא לקוח עם המייל: ${email}</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`Customer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            
            // Get detailed customer - CHECK FOR RELATIONS HERE
            let detailedCustomer = customerAsset;
            let embeddedRelations = [];
            
            try {
                const detailResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${customerAsset.id}`, {
                    headers: { 'x-api-key': HUDU_API_KEY }
                });
                
                if (detailResponse.data?.asset) {
                    detailedCustomer = detailResponse.data.asset;
                    
                    // LOG ALL POSSIBLE RELATION FIELDS
                    console.log('=== CHECKING FOR RELATIONS ===');
                    console.log('Has relations?', !!detailedCustomer.relations);
                    console.log('Has related_items?', !!detailedCustomer.related_items);
                    console.log('Has related_assets?', !!detailedCustomer.related_assets);
                    console.log('Has associations?', !!detailedCustomer.associations);
                    console.log('All keys:', Object.keys(detailedCustomer));
                    
                    // Try to get relations from any field
                    embeddedRelations = detailedCustomer.relations || 
                                       detailedCustomer.related_items || 
                                       detailedCustomer.related_assets || 
                                       detailedCustomer.associations || 
                                       [];
                    
                    console.log(`Embedded relations count: ${embeddedRelations.length}`);
                    if (embeddedRelations.length > 0) {
                        console.log('Sample relation:', JSON.stringify(embeddedRelations[0], null, 2));
                    }
                }
            } catch (error) {
                console.log('Error getting detailed customer:', error.message);
            }
            
            // Get company assets
            let relatedAssets = [];
            const customerName = detailedCustomer.name.toLowerCase().trim();
            const nameParts = customerName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            
            console.log('=== SEARCHING COMPANY ASSETS ===');
            console.log('Customer name:', customerName);
            console.log('First name:', firstName);
            console.log('Last name:', lastName);
            
            try {
                const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${detailedCustomer.company_id}/assets`, {
                    headers: { 'x-api-key': HUDU_API_KEY },
                    params: { page_size: 250, archived: false }
                });
                
                const companyAssets = companyResponse.data?.assets || [];
                console.log(`Company has ${companyAssets.length} total assets`);
                
                // Log asset types in company
                const typeCount = {};
                companyAssets.forEach(a => {
                    const type = a.asset_type || 'Unknown';
                    typeCount[type] = (typeCount[type] || 0) + 1;
                });
                console.log('Asset types in company:', typeCount);
                
                // Find related assets
                for (const asset of companyAssets) {
                    if (asset.id === customerAsset.id) continue;
                    
                    const assetType = (asset.asset_type || '').toLowerCase();
                    if (assetType.includes('people') || assetType.includes('person')) continue;
                    
                    const assetName = (asset.name || '').toLowerCase();
                    let matchFound = false;
                    let matchReason = '';
                    
                    // Check various matching criteria
                    if (customerName && assetName === customerName) {
                        matchFound = true;
                        matchReason = 'Exact name match';
                    } else if (customerName && assetName.includes(customerName)) {
                        matchFound = true;
                        matchReason = 'Full name match';
                    } else if (firstName && firstName.length > 2 && assetName.includes(firstName)) {
                        matchFound = true;
                        matchReason = `Contains "${firstName}"`;
                    } else if (lastName && lastName.length > 2 && assetName.includes(lastName)) {
                        matchFound = true;
                        matchReason = `Contains "${lastName}"`;
                    }
                    
                    // Check fields
                    if (!matchFound && asset.fields) {
                        for (const field of asset.fields) {
                            const fieldValue = (field.value || '').toString().toLowerCase();
                            
                            if (email && fieldValue.includes(email.toLowerCase())) {
                                matchFound = true;
                                matchReason = `Email in ${field.label}`;
                                break;
                            }
                            
                            if (customerName && fieldValue.includes(customerName)) {
                                matchFound = true;
                                matchReason = `Name in ${field.label}`;
                                break;
                            }
                        }
                    }
                    
                    if (matchFound) {
                        console.log(`MATCH: ${asset.name} (${asset.asset_type}) - Reason: ${matchReason}`);
                        relatedAssets.push({
                            ...asset,
                            match_reason: matchReason
                        });
                    }
                }
                
                console.log(`=== FOUND ${relatedAssets.length} RELATED ASSETS ===`);
                
            } catch (error) {
                console.log('Error getting company assets:', error.message);
            }
            
            // Process embedded relations if found
            if (embeddedRelations.length > 0) {
                console.log('=== PROCESSING EMBEDDED RELATIONS ===');
                for (const relation of embeddedRelations) {
                    try {
                        // Try different formats
                        let relatedId = relation.id || relation.asset_id || relation.related_id;
                        
                        if (relatedId && relatedId !== customerAsset.id) {
                            const assetResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/assets/${relatedId}`, {
                                headers: { 'x-api-key': HUDU_API_KEY }
                            });
                            
                            if (assetResponse.data?.asset) {
                                const asset = assetResponse.data.asset;
                                console.log(`EMBEDDED: ${asset.name} (${asset.asset_type})`);
                                
                                // Add if not already in list
                                if (!relatedAssets.find(a => a.id === asset.id)) {
                                    relatedAssets.push({
                                        ...asset,
                                        match_reason: 'Linked in Hudu'
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.log('Error fetching embedded relation:', error.message);
                    }
                }
            }
            
            console.log('=== DEBUG END ===');
            
            // Generate response
            const htmlMessage = `
                <div style='font-family: Arial, sans-serif; font-size: 13px;'>
                    <div style='background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px;'>
                        <div style='font-size: 18px; font-weight: 600;'>👤 ${detailedCustomer.name}</div>
                        <div style='font-size: 11px; opacity: 0.9; margin-top: 5px;'>
                            ${detailedCustomer.company_name || 'Company'} | 
                            נמצאו: ${relatedAssets.length} נכסים | 
                            Embedded: ${embeddedRelations.length}
                        </div>
                    </div>
                    
                    <div style='padding: 15px; background: #f8f9fa; border-radius: 0 0 8px 8px; margin: 0 -10px -10px -10px;'>
                        <h3 style='font-size: 14px; margin: 0 0 10px 0;'>
                            🔗 נכסים קשורים (${relatedAssets.length})
                        </h3>
                        
                        ${relatedAssets.map(item => `
                            <div style='background: white; border-radius: 6px; padding: 10px; margin: 8px 0; border: 1px solid #dee2e6;'>
                                <div style='font-weight: 600; color: #212529;'>${item.name}</div>
                                <div style='font-size: 11px; color: #6c757d; margin-top: 4px;'>
                                    <span style='background: #0ea5e9; color: white; padding: 2px 6px; border-radius: 6px; margin-right: 4px;'>
                                        ${item.asset_type}
                                    </span>
                                    <span style='background: #10b981; color: white; padding: 2px 6px; border-radius: 6px;'>
                                        ${item.match_reason}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                        
                        ${relatedAssets.length === 0 ? `
                            <div style='text-align: center; padding: 20px; color: #6c757d;'>
                                🔍 לא נמצאו נכסים קשורים<br>
                                <span style='font-size: 11px;'>Embedded relations: ${embeddedRelations.length}</span>
                            </div>
                        ` : ''}
                        
                        <div style='margin-top: 15px; padding-top: 10px; border-top: 1px solid #dee2e6; font-size: 11px; color: #6c757d;'>
                            Debug: Check console for detailed logs
                        </div>
                    </div>
                </div>
            `;
            
            res.status(200).json({
                "message": htmlMessage,
                "statusCode": "200"
            });
            
        } catch (error) {
            console.error('ERROR:', error);
            res.status(200).json({
                "message": `<div style='color: red;'>Error: ${error.message}</div>`,
                "statusCode": "500"
            });
        }
    }
};
