// שמור את זה בקובץ: api/dashboard.js

module.exports = (req, res) => {
    const htmlContent = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BoldDesk-Hudu Integration Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            font-size: 28px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .status {
            display: flex;
            gap: 20px;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: #f8f9fa;
            border-radius: 20px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #28a745;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        
        .card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        .card-title {
            font-size: 20px;
            font-weight: 600;
            color: #333;
        }
        
        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .badge.new { background: #d4edda; color: #155724; }
        .badge.normal { background: #fff3cd; color: #856404; }
        .badge.high { background: #f8d7da; color: #721c24; }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f5f5f5;
        }
        
        .info-label {
            color: #666;
            font-size: 14px;
        }
        
        .info-value {
            color: #333;
            font-weight: 500;
            font-size: 14px;
        }
        
        .link-button {
            display: inline-block;
            padding: 8px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            transition: transform 0.2s;
        }
        
        .link-button:hover {
            transform: translateY(-2px);
        }
        
        .activity-log {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-top: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        
        .log-item {
            display: flex;
            gap: 15px;
            padding: 15px 0;
            border-bottom: 1px solid #f5f5f5;
        }
        
        .log-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        
        .log-icon.ticket { background: #e3f2fd; }
        .log-icon.customer { background: #f3e5f5; }
        .log-icon.sync { background: #e8f5e9; }
        
        .log-content {
            flex: 1;
        }
        
        .log-title {
            font-weight: 500;
            color: #333;
            margin-bottom: 5px;
        }
        
        .log-time {
            font-size: 12px;
            color: #999;
        }
        
        .search-bar {
            width: 300px;
            padding: 10px 20px;
            border: 2px solid #e0e0e0;
            border-radius: 25px;
            font-size: 14px;
            transition: border-color 0.3s;
        }
        
        .search-bar:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .custom-fields {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
        }
        
        .custom-field {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
        }
        
        .custom-field-label {
            color: #666;
            font-size: 13px;
        }
        
        .custom-field-value {
            color: #333;
            font-weight: 500;
            font-size: 13px;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: white;
            font-size: 24px;
        }
        
        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .header {
                flex-direction: column;
                gap: 20px;
            }
            
            .search-bar {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Loading State -->
        <div id="loading" class="loading">
            🔄 טוען נתונים...
        </div>
        
        <!-- Main Content (Hidden initially) -->
        <div id="mainContent" style="display: none;">
            <!-- Header -->
            <div class="header">
                <div class="logo">🔗 BoldDesk-Hudu Integration</div>
                <input type="text" class="search-bar" placeholder="חיפוש לפי מייל או מספר טיקט..." id="searchBar">
                <div class="status">
                    <div class="status-item">
                        <span class="status-dot"></span>
                        <span>BoldDesk מחובר</span>
                    </div>
                    <div class="status-item">
                        <span class="status-dot"></span>
                        <span>Hudu מחובר</span>
                    </div>
                </div>
            </div>
            
            <!-- Dashboard Grid -->
            <div class="dashboard">
                <!-- BoldDesk Ticket Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">🎫 פרטי טיקט - BoldDesk</h2>
                        <span class="badge new">חדש</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">מספר טיקט:</span>
                        <span class="info-value" id="ticketId">#65559</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">נושא:</span>
                        <span class="info-value" id="ticketSubject">test</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">קטגוריה:</span>
                        <span class="info-value" id="ticketCategory">Computer</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">עדיפות:</span>
                        <span class="info-value badge normal" id="ticketPriority">Normal</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">מבקש:</span>
                        <span class="info-value" id="ticketRequester">mor (mormoria5@gmail.com)</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">קבוצת קשר:</span>
                        <span class="info-value" id="ticketContactGroup">Accounting Mizra</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">נוצר על ידי:</span>
                        <span class="info-value" id="ticketCreator">Mor Nahmani</span>
                    </div>
                    
                    <!-- Custom Fields -->
                    <div class="custom-fields">
                        <h4 style="margin-bottom: 10px; color: #666;">שדות מותאמים אישית:</h4>
                        <div class="custom-field">
                            <span class="custom-field-label">Child Contact:</span>
                            <span class="custom-field-value" id="cfChildContact">27</span>
                        </div>
                        <div class="custom-field">
                            <span class="custom-field-label">Domain 365:</span>
                            <span class="custom-field-value" id="cfDomain365">Mizra.co.il</span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <a href="https://morget-morco.bolddesk.com/agent" class="link-button" target="_blank">
                            פתח ב-BoldDesk →
                        </a>
                    </div>
                </div>
                
                <!-- Hudu Customer Card -->
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">👤 פרטי לקוח - Hudu</h2>
                        <span class="badge new" id="huduStatus">נמצא</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">שם:</span>
                        <span class="info-value" id="huduName">מוריה נחמני</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">חברה:</span>
                        <span class="info-value" id="huduCompany">Friend Mizra</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">מזהה נכס:</span>
                        <span class="info-value" id="huduAssetId">#5538</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">סוג נכס:</span>
                        <span class="info-value" id="huduAssetType">People</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">מייל:</span>
                        <span class="info-value" id="huduEmail">mormoria5@gmail.com</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">נוצר:</span>
                        <span class="info-value" id="huduCreated">29/07/2025</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">עודכן:</span>
                        <span class="info-value" id="huduUpdated">29/07/2025</span>
                    </div>
                    <div style="margin-top: 20px;">
                        <a href="https://get-mor.huducloud.com/a/463499cacee5" class="link-button" target="_blank" id="huduLink">
                            פתח ב-Hudu →
                        </a>
                    </div>
                </div>
            </div>
            
            <!-- Activity Log -->
            <div class="activity-log">
                <h2 class="card-title" style="margin-bottom: 20px;">📊 היסטוריית פעילות</h2>
                
                <div class="log-item">
                    <div class="log-icon ticket">🎫</div>
                    <div class="log-content">
                        <div class="log-title">טיקט חדש נוצר ב-BoldDesk</div>
                        <div class="log-time">לפני 5 דקות</div>
                    </div>
                </div>
                
                <div class="log-item">
                    <div class="log-icon sync">🔄</div>
                    <div class="log-content">
                        <div class="log-title">Webhook התקבל בהצלחה</div>
                        <div class="log-time">לפני 4 דקות</div>
                    </div>
                </div>
                
                <div class="log-item">
                    <div class="log-icon customer">👤</div>
                    <div class="log-content">
                        <div class="log-title">לקוח נמצא ב-Hudu: מוריה נחמני</div>
                        <div class="log-time">לפני 3 דקות</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Show content after load
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }, 1000);
        
        // Search functionality
        document.getElementById('searchBar').addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            console.log('Searching for:', searchTerm);
        });
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlContent);
};
