// Deep Debug Version - Let's find why assets are missing
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

// Helper function to normalize text
function normalizeText(text) {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
        .replace(/[\s\-\_\.]+/g, ' ')
        .replace(/[^\u0590-\u05FF\w\s]/g, '');
}

module.exports = async (req, res) => {
    console.log(`${req.method} request received`);
    
    // Special debug endpoint - list ALL assets in company with details
    if (req.method === 'GET' && req.query.debug_all) {
        try {
            const companyId = req.query.company_id;
            const searchTerm = req.query.search || '';
            
            if (!companyId) {
                res.json({ error: 'Please provide company_id parameter' });
                return;
            }
            
            const response = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${companyId}/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { page_size: 250, archived: false }
            });
            
            const assets = response.data?.assets || [];
            
            // Create detailed list
            const detailedAssets = assets.map(asset => ({
                id: asset.id,
                name: asset.name,
                type: asset.asset_type,
                fields_summary: asset.fields ? asset.fields.map(f => ({
                    label: f.label,
                    value: f.value ? f.value.toString().substring(0, 50) : null
                })).filter(f => f.value) : []
            }));
            
            // If search term provided, show why each asset matches or not
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const results = detailedAssets.map(asset => {
                    const nameMatch = asset.name.toLowerCase().includes(searchLower);
                    const fieldMatches = [];
                    
                    asset.fields_summary.forEach(field => {
                        if (field.value && field.value.toLowerCase().includes(searchLower)) {
                            fieldMatches.push(field.label);
                        }
                    });
                    
                    return {
                        ...asset,
                        matches: {
                            name_match: nameMatch,
                            field_matches: fieldMatches,
                            would_be_selected: nameMatch || fieldMatches.length > 0
                        }
                    };
                });
                
                res.json({
                    search_term: searchTerm,
                    total_assets: assets.length,
                    matching_assets: results.filter(a => a.matches.would_be_selected),
                    non_matching_sample: results.filter(a => !a.matches.would_be_selected).slice(0, 5)
                });
            } else {
                res.json({
                    company_id: companyId,
                    total_assets: assets.length,
                    assets: detailedAssets
                });
            }
            
            return;
        } catch (error) {
            res.json({ error: error.message });
            return;
        }
    }
    
    // Normal GET
    if (req.method === 'GET') {
        res.status(200).json({
            "message": `
                <div style='padding: 15px; background: #8b5cf6; color: white; border-radius: 8px;'>
                    <h3>🔍 Deep Debug Version</h3>
                    <p style='font-size: 11px;'>
                        Debug: GET ?debug_all=1&company_id=ID&search=NAME<br/>
                        This will show ALL assets and why they match or don't
                    </p>
                </div>
            `,
            "statusCode": "200"
        });
        return;
    }
    
    // Handle POST with extensive logging
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
            
            console.log('\n=== DEEP DEBUG START ===');
            console.log('Email:', email);
            
            if (!email || !HUDU_API_KEY || !HUDU_BASE_URL) {
                res.status(200).json({
                    "message": `<div style='color: red;'>Missing requirements</div>`,
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
            console.log(`Search returned ${searchResults.length} assets`);
            
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
                    "message": `<div style='color: red;'>Customer not found</div>`,
                    "statusCode": "200"
                });
                return;
            }
            
            console.log(`\nCustomer: ${customerAsset.name} (ID: ${customerAsset.id})`);
            console.log(`Company ID: ${customerAsset.company_id}`);
            
            // Get company assets with detailed logging
            const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                headers: { 'x-api-key': HUDU_API_KEY },
                params: { page_size: 250, archived: false }
            });
            
            const companyAssets = companyResponse.data?.assets || [];
            console.log(`\nCompany has ${companyAssets.length} total assets`);
            
            // Group by type and show samples
            const assetsByType = {};
            companyAssets.forEach(asset => {
                const type = asset.asset_type || 'Unknown';
                if (!assetsByType[type]) assetsByType[type] = [];
                assetsByType[type].push(asset.name);
            });
            
            console.log('\nAssets by type:');
            Object.entries(assetsByType).forEach(([type, names]) => {
                console.log(`  ${type}: ${names.length} assets`);
                if (names.length <= 3) {
                    names.forEach(name => console.log(`    - ${name}`));
                } else {
                    console.log(`    - ${names.slice(0, 3).join(', ')}...`);
                }
            });
            
            // Detailed matching process
            const customerName = normalizeText(customerAsset.name);
            const nameParts = customerName.split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            
            console.log('\nMatching criteria:');
            console.log(`  Full name: "${customerName}"`);
            console.log(`  First name: "${firstName}"`);
            console.log(`  Last name: "${lastName}"`);
            console.log(`  Email: "${email}"`);
            
            let relatedAssets = [];
            const notMatchedButInteresting = [];
            
            console.log('\n=== CHECKING EACH ASSET ===');
            
            for (const asset of companyAssets) {
                if (asset.id === customerAsset.id) continue;
                
                const assetType = (asset.asset_type || '').toLowerCase();
                const assetNameNorm = normalizeText(asset.name);
                
                // Skip other people
                if (assetType.includes('people') || 
                    assetType.includes('person') || 
                    assetType.includes('contact') ||
                    assetType === 'contact in atera') {
                    continue;
                }
                
                // Log interesting assets even if they don't match
                const isInterestingType = assetType.includes('email') || 
                                         assetType.includes('365') || 
                                         assetType.includes('computer') ||
                                         assetType.includes('license') ||
                                         assetType.includes('password');
                
                let matchFound = false;
                let matchReason = '';
                let debugInfo = {
                    asset_name: asset.name,
                    asset_type: asset.asset_type,
                    normalized_name: assetNameNorm,
                    checks: []
                };
                
                // Check 1: Full name
                if (customerName && assetNameNorm.includes(customerName)) {
                    matchFound = true;
                    matchReason = 'Full name match';
                    debugInfo.checks.push('✓ Full name match');
                } else {
                    debugInfo.checks.push(`✗ Full name: "${assetNameNorm}" doesn't contain "${customerName}"`);
                }
                
                // Check 2: First name
                if (!matchFound && firstName && firstName.length > 2) {
                    if (assetNameNorm.includes(firstName)) {
                        matchFound = true;
                        matchReason = `Contains "${firstName}"`;
                        debugInfo.checks.push(`✓ First name match: "${firstName}"`);
                    } else {
                        debugInfo.checks.push(`✗ First name: "${assetNameNorm}" doesn't contain "${firstName}"`);
                    }
                }
                
                // Check 3: Last name
                if (!matchFound && lastName && lastName.length > 2) {
                    if (assetNameNorm.includes(lastName)) {
                        matchFound = true;
                        matchReason = `Contains "${lastName}"`;
                        debugInfo.checks.push(`✓ Last name match: "${lastName}"`);
                    } else {
                        debugInfo.checks.push(`✗ Last name: "${assetNameNorm}" doesn't contain "${lastName}"`);
                    }
                }
                
                // Check 4: Fields
                if (!matchFound && asset.fields) {
                    for (const field of asset.fields) {
                        if (!field.value) continue;
                        
                        const fieldValue = field.value.toString().toLowerCase();
                        
                        if (email && fieldValue.includes(email.toLowerCase())) {
                            matchFound = true;
                            matchReason = `Email in ${field.label}`;
                            debugInfo.checks.push(`✓ Email found in field: ${field.label}`);
                            break;
                        }
                        
                        if (customerName && fieldValue.includes(customerName)) {
                            matchFound = true;
                            matchReason = `Name in ${field.label}`;
                            debugInfo.checks.push(`✓ Name found in field: ${field.label}`);
                            break;
                        }
                    }
                    
                    if (!matchFound) {
                        debugInfo.checks.push(`✗ No match in ${asset.fields.length} fields`);
                    }
                }
                
                // Log interesting non-matches
                if (!matchFound && isInterestingType) {
                    console.log(`\n❓ Interesting non-match: ${asset.name} (${asset.asset_type})`);
                    debugInfo.checks.forEach(check => console.log(`   ${check}`));
                    
                    notMatchedButInteresting.push({
                        name: asset.name,
                        type: asset.asset_type,
                        reason_not_matched: debugInfo.checks.filter(c => c.startsWith('✗')).join('; ')
                    });
                }
                
                if (matchFound) {
                    console.log(`\n✅ MATCHED: ${asset.name} (${asset.asset_type})`);
                    console.log(`   Reason: ${matchReason}`);
                    
                    relatedAssets.push({
                        ...asset,
                        match_reason: matchReason
                    });
                }
            }
            
            console.log('\n=== SUMMARY ===');
            console.log(`Found ${relatedAssets.length} matching assets`);
            console.log(`${notMatchedButInteresting.length} interesting assets didn't match`);
            
            if (notMatchedButInteresting.length > 0) {
                console.log('\nAssets that might be related but didn\'t match:');
                notMatchedButInteresting.forEach(item => {
                    console.log(`  - ${item.name} (${item.type})`);
                    console.log(`    Why not: ${item.reason_not_matched}`);
                });
            }
            
            console.log('\n=== DEEP DEBUG END ===\n');
            
            // Generate response
            const htmlMessage = `
                <div style='font-family: Arial, sans-serif; font-size: 13px;'>
                    <div style='background: #8b5cf6; color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 0 -10px;'>
                        <div style='font-size: 18px; font-weight: 600;'>👤 ${customerAsset.name}</div>
                        <div style='font-size: 11px; margin-top: 5px;'>
                            Found: ${relatedAssets.length} | 
                            Might be related: ${notMatchedButInteresting.length}
                        </div>
                    </div>
                    
                    <div style='padding: 15px; background: #f8f9fa; border-radius: 0 0 8px 8px; margin: 0 -10px -10px -10px;'>
                        <h3 style='font-size: 14px;'>✅ נכסים שנמצאו (${relatedAssets.length})</h3>
                        ${relatedAssets.map(item => `
                            <div style='background: white; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #10b981;'>
                                <strong>${item.name}</strong><br/>
                                <span style='font-size: 11px; color: #666;'>
                                    ${item.asset_type} | ${item.match_reason}
                                </span>
                            </div>
                        `).join('')}
                        
                        ${notMatchedButInteresting.length > 0 ? `
                            <h3 style='font-size: 14px; margin-top: 20px;'>❓ נכסים שלא התאימו (${notMatchedButInteresting.length})</h3>
                            ${notMatchedButInteresting.map(item => `
                                <div style='background: white; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #f59e0b;'>
                                    <strong>${item.name}</strong><br/>
                                    <span style='font-size: 11px; color: #666;'>
                                        ${item.type}<br/>
                                        <span style='color: #dc2626;'>לא התאים כי: ${item.reason_not_matched}</span>
                                    </span>
                                </div>
                            `).join('')}
                        ` : ''}
                        
                        <div style='margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 6px;'>
                            <strong>💡 טיפ:</strong> בדוק בקונסול את הלוגים המפורטים
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
