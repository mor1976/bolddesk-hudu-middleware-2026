// api/index.js - עדכון החלק של התגובה ל-webhook

// בתוך ה-webhook handler, אחרי שמצאת את הלקוח ב-Hudu
// במקום להחזיר JSON, החזר HTML:

if (path === '/bolddesk-webhook' && req.method === 'POST') {
    try {
        // ... כל הקוד של חיפוש המייל והלקוח ...
        
        // אם נמצא לקוח ב-Hudu
        if (huduAsset) {
            // החזר HTML שיוצג ב-BoldDesk Custom App
            const htmlResponse = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        padding: 15px;
                        margin: 0;
                        background: #ffffff;
                    }
                    .hudu-info {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 15px;
                    }
                    .hudu-title {
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                    }
                    .hudu-title img {
                        width: 24px;
                        height: 24px;
                        margin-right: 8px;
                    }
                    .info-grid {
                        display: grid;
                        gap: 10px;
                    }
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 6px;
                        border-left: 3px solid #667eea;
                    }
                    .info-label {
                        font-weight: 600;
                        color: #495057;
                    }
                    .info-value {
                        color: #212529;
                        text-align: right;
                    }
                    .hudu-link {
                        display: inline-block;
                        margin-top: 15px;
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        color: white;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 500;
                        transition: transform 0.2s;
                    }
                    .hudu-link:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                    }
                    .success-badge {
                        display: inline-block;
                        background: #d4edda;
                        color: #155724;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        margin-left: 10px;
                    }
                    .company-badge {
                        display: inline-block;
                        background: #e7f3ff;
                        color: #004085;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    .asset-id {
                        color: #6c757d;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="hudu-info">
                    <div class="hudu-title">
                        🔗 Hudu Customer Information
                        <span class="success-badge">✓ Verified</span>
                    </div>
                </div>
                
                <div class="info-grid">
                    <div class="info-row">
                        <span class="info-label">👤 Customer Name:</span>
                        <span class="info-value">${huduAsset.name}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">🏢 Company:</span>
                        <span class="info-value">
                            <span class="company-badge">${huduAsset.company_name}</span>
                        </span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">🆔 Asset ID:</span>
                        <span class="info-value asset-id">#${huduAsset.id}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">📧 Email:</span>
                        <span class="info-value">${customerEmail}</span>
                    </div>
                    
                    ${huduAsset.asset_type ? `
                    <div class="info-row">
                        <span class="info-label">📁 Type:</span>
                        <span class="info-value">${huduAsset.asset_type}</span>
                    </div>
                    ` : ''}
                    
                    <div class="info-row">
                        <span class="info-label">📅 Last Updated:</span>
                        <span class="info-value">${new Date(huduAsset.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${huduAsset.url}" target="_blank" class="hudu-link">
                        🔍 View Full Details in Hudu →
                    </a>
                </div>
            </body>
            </html>
            `;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(htmlResponse);
            
        } else {
            // אם לא נמצא לקוח
            const notFoundHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        padding: 15px;
                        margin: 0;
                    }
                    .not-found {
                        background: #fff3cd;
                        color: #856404;
                        padding: 15px;
                        border-radius: 8px;
                        border: 1px solid #ffeaa7;
                        text-align: center;
                    }
                    .not-found h3 {
                        margin: 0 0 10px 0;
                    }
                    .email {
                        font-weight: bold;
                        color: #721c24;
                    }
                </style>
            </head>
            <body>
                <div class="not-found">
                    <h3>⚠️ Customer Not Found in Hudu</h3>
                    <p>Email: <span class="email">${customerEmail || 'No email provided'}</span></p>
                    <p>This customer needs to be added to Hudu.</p>
                </div>
            </body>
            </html>
            `;
            
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(notFoundHTML);
        }
        
    } catch (error) {
        // שגיאה
        const errorHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial; padding: 15px; }
                .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="error">
                <strong>❌ Error:</strong> ${error.message}
            </div>
        </body>
        </html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(errorHTML);
    }
}
