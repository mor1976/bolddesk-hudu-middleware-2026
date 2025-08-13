// Simple debug version to see exactly what's happening
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
                    
                    // 2. Get ALL assets in company
                    const companyResponse = await axios.get(`${HUDU_BASE_URL}/api/v1/companies/${customerAsset.company_id}/assets`, {
                        headers: { 'x-api-key': HUDU_API_KEY, 'Content-Type': 'application/json' },
                        params: { page_size: 200 }
                    });
                    
                    const allCompanyAssets = companyResponse.data?.assets || [];
                    console.log(`Found ${allCompanyAssets.length} total assets in company`);
                    
                    // 3. Debug: show all assets
                    const customerName = customerAsset.name.toLowerCase();
                    const nameParts = customerName.split(/\s+/);
                    const firstName = nameParts[0];
                    const lastName = nameParts[nameParts.length - 1];
                    
                    console.log('Customer name parts:', { customerName, firstName, lastName });
                    
                    // Create detailed debug message
                    const htmlMessage = `
                        <div style='font-family: Arial; font-size: 12px; padding: 15px;'>
                            <h3 style='color: #333;'>🔍 Debug: חיפוש נכסים עבור ${customerAsset.name}</h3>
                            
                            <div style='background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 5px;'>
                                <strong>פרטי לקוח:</strong><br>
                                שם: ${customerAsset.name}<br>
                                חברה: ${customerAsset.company_name}<br>
                                מייל: ${email}<br>
                                מונחי חיפוש: "${firstName}", "${lastName}"
                            </div>
                            
                            <div style='background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 5px;'>
                                <strong>סה"כ נכסים בחברה: ${allCompanyAssets.length}</strong>
                            </div>
                            
                            <h4>כל הנכסים בחברה:</h4>
                            <ol style='background: #f8f9fa; padding: 15px; border-radius: 5px;'>
                                ${allCompanyAssets.map(asset => {
                                    const isCustomer = asset.id === customerAsset.id;
                                    const nameMatch = asset.name.toLowerCase().includes(firstName) || 
                                                     (lastName && asset.name.toLowerCase().includes(lastName));
                                    
                                    return `<li style='margin: 5px 0; ${isCustomer ? 'background: #ffeb3b; padding: 5px;' : nameMatch ? 'background: #c8e6c9; padding: 5px;' : ''}'>
                                        <strong>${asset.name}</strong> (${asset.asset_type})
                                        ${isCustomer ? ' <span style="color: red;">[הלקוח]</span>' : ''}
                                        ${nameMatch && !isCustomer ? ' <span style="color: green;">[התאמה לשם]</span>' : ''}
                                    </li>`;
                                }).join('')}
                            </ol>
                            
                            <div style='background: #ffebee; padding: 10px; margin: 10px 0; border-radius: 5px;'>
                                <strong>השאלה:</strong> מדוע ב-Related Items מופיע רק נכס אחד במקום ${allCompanyAssets.length - 1}?
                            </div>
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
            "message": "<div style='padding: 15px; background: #28a745; color: white; border-radius: 8px; text-align: center;'><h3>✅ BoldDesk-Hudu Integration Active</h3><p>Debug version. Updated: " + new Date().toLocaleString() + "</p></div>",
            "statusCode": "200"
        };
        res.status(200).json(testResponse);
    } 
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
};
