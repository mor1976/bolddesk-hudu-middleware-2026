// api/bolddesk.js - הפורמט הנכון ל-BoldDesk Custom App
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    console.log(`📨 ${req.method} request from BoldDesk`);
    
    try {
        // רק POST requests - כי BoldDesk שולח POST עם הנתונים
        if (req.method === 'POST') {
            console.log('Payload received:', JSON.stringify(req.body, null, 2));
            
            // חלץ את המייל מהנתונים
            const email = findEmail(req.body);
            console.log('Email found:', email);
            
            let htmlContent = '';
            
            if (email && HUDU_API_KEY && HUDU_BASE_URL) {
                try {
                    // חפש ב-Hudu
                    const response = await axios.get(
                        `${HUDU_BASE_URL}/api/v1/assets`,
                        {
                            headers: {
                                'x-api-key': HUDU_API_KEY,
                                'Content-Type': 'application/json'
                            },
                            params: { search: email }
                        }
                    );
                    
                    if (response.data?.assets?.length > 0) {
                        const asset = response.data.assets[0];
                        console.log(`✅ Found in Hudu: ${asset.name}`);
                        
                        // בנה HTML content - חייב להיות escaped!
                        htmlContent = `
                            <div style='border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden;'>
                                <div style='background: linear-gradient(90deg, #6366f1, #8b5cf6); color: white; padding: 10px; font-size: 14px; font-weight: 600;'>
                                    ✅ Customer Found in Hudu
                                </div>
                                <div style='padding: 12px;'>
                                    <div style='margin-bottom: 8px;'>
                                        <strong>Name:</strong> ${asset.name}
                                    </div>
                                    <div style='margin-bottom: 8px;'>
                                        <strong>Company:</strong> ${asset.company_name}
                                    </div>
                                    <div style='margin-bottom: 8px;'>
                                        <strong>Email:</strong> ${email}
                                    </div>
                                    <div style='margin-bottom: 12px;'>
                                        <strong>Asset ID:</strong> #${asset.id}
                                    </div>
                                    <a href='${asset.url}' target='_blank' style='display: inline-block; padding: 8px 16px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;'>
                                        Open in Hudu →
                                    </a>
                                </div>
                            </div>
                        `;
                    } else {
                        console.log('❌ Not found in Hudu');
                        htmlContent = `
                            <div style='padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; text-align: center; font-size: 13px;'>
                                ⚠️ Customer not found in Hudu<br>
                                <small style='color: #856404;'>${email}</small>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Hudu API error:', error.message);
                    htmlContent = `
                        <div style='padding: 12px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; color: #721c24; font-size: 13px;'>
                            ❌ Error connecting to Hudu: ${error.message}
                        </div>
                    `;
                }
            } else {
                htmlContent = `
                    <div style='padding: 12px; background: #e2e3e5; border: 1px solid #d6d8db; border-radius: 6px; text-align: center; font-size: 13px; color: #383d41;'>
                        ℹ️ No email found in ticket data
                    </div>
                `;
            }
            
            // החזר בפורמט שBoldDesk מצפה לו!
            const response = {
                message: htmlContent,
                statusCode: "200"
            };
            
            console.log('Sending response to BoldDesk');
            res.status(200).json(response);
            
        } else {
            // לבקשות GET או אחרות
            res.status(200).json({
                message: "<div>BoldDesk Custom App is Active</div>",
                statusCode: "200"
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        // גם שגיאות צריכות להיות בפורמט הנכון
        res.status(200).json({
            message: `<div style='color: red;'>Error: ${error.message}</div>`,
            statusCode: "500"
        });
    }
};

// פונקציה למציאת מייל בנתונים
function findEmail(data) {
    if (!data) return null;
    
    // BoldDesk שולח את הנתונים בתוך ticket object
    const ticket = data.ticket || data;
    
    // נסה למצוא במקומות שונים
    const paths = [
        'requester.EmailId',
        'requester.email',
        'requester.Email',
        'customer.EmailId',
        'customer.email',
        'customer.Email',
        'contact.email',
        'contact.EmailId',
        'EmailId',
        'email',
        'Email'
    ];
    
    for (const path of paths) {
        const value = getNestedValue(ticket, path);
        if (value && value.includes('@')) {
            return value;
        }
    }
    
    // אם לא מצאנו, נסה לחפש בכל האובייקט
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const jsonString = JSON.stringify(data);
    const match = jsonString.match(emailRegex);
    return match ? match[0] : null;
}

// פונקציה עזר לקבלת ערך מנתיב
function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return null;
        }
    }
    
    return current;
}
