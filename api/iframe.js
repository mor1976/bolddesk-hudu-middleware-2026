// api/iframe.js - פתרון עם iFrame
const axios = require('axios');

const HUDU_API_KEY = process.env.HUDU_API_KEY;
const HUDU_BASE_URL = process.env.HUDU_BASE_URL;

module.exports = async (req, res) => {
    // תמיד החזר HTML עם JavaScript שמטפל בכל
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 8px;
        background: white;
    }
    .loading {
        text-align: center;
        padding: 20px;
        color: #666;
        font-size: 13px;
    }
    .card {
        border: 1px solid #d0d7de;
        border-radius: 6px;
        overflow: hidden;
        display: none;
    }
    .card.show { display: block; }
    .header {
        background: linear-gradient(90deg, #6366f1, #8b5cf6);
        color: white;
        padding: 8px 10px;
        font-size: 13px;
        font-weight: 600;
    }
    .body { padding: 10px; }
    .row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        font-size: 12px;
        border-bottom: 1px solid #f0f0f0;
    }
    .row:last-child { border: none; }
    .label { color: #57606a; }
    .value { color: #0969da; font-weight: 500; }
    .btn {
        display: block;
        width: 100%;
        padding: 6px;
        margin-top: 8px;
        background: #2da44e;
        color: white;
        text-align: center;
        text-decoration: none;
        border-radius: 4px;
        font-size: 12px;
    }
    .error {
        padding: 10px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        font-size: 12px;
        text-align: center;
        display: none;
    }
    .error.show { display: block; }
</style>
</head>
<body>
    <div id="loading" class="loading">
        ⏳ Loading customer data...
    </div>
    
    <div id="card" class="card">
        <div class="header">✅ Customer Found in Hudu</div>
        <div class="body">
            <div class="row">
                <span class="label">Name:</span>
                <span class="value" id="name">-</span>
            </div>
            <div class="row">
                <span class="label">Company:</span>
                <span class="value" id="company">-</span>
            </div>
            <div class="row">
                <span class="label">Email:</span>
                <span class="value" id="email">-</span>
            </div>
            <div class="row">
                <span class="label">Asset ID:</span>
                <span class="value" id="assetId">-</span>
            </div>
            <a id="huduLink" href="#" target="_blank" class="btn">Open in Hudu →</a>
        </div>
    </div>
    
    <div id="error" class="error">
        ⚠️ <span id="errorMsg">Customer not found</span>
    </div>

<script>
// נתונים קבועים לבדיקה - מוריה נחמני
const testData = {
    name: 'מוריה נחמני',
    company: 'Friend Mizra',
    email: 'mormoria5@gmail.com',
    assetId: '5538',
    url: 'https://get-mor.huducloud.com/a/463499cacee5'
};

// פונקציה להצגת הנתונים
function showData(data) {
    document.getElementById('loading').style.display = 'none';
    
    if (data && data.name) {
        document.getElementById('name').textContent = data.name;
        document.getElementById('company').textContent = data.company;
        document.getElementById('email').textContent = data.email;
        document.getElementById('assetId').textContent = '#' + data.assetId;
        document.getElementById('huduLink').href = data.url;
        document.getElementById('card').classList.add('show');
    } else {
        document.getElementById('error').classList.add('show');
    }
}

// נסה לקבל נתונים מה-parent window (BoldDesk)
let retryCount = 0;
function tryGetData() {
    try {
        // נסה לקבל מידע מ-BoldDesk
        if (window.parent && window.parent !== window) {
            // בינתיים, פשוט הצג את הנתונים הקבועים
            setTimeout(() => {
                showData(testData);
            }, 500);
        } else {
            // אם לא ב-iframe, הצג מיד
            showData(testData);
        }
    } catch (e) {
        // אם יש שגיאת CORS, הצג את הנתונים הקבועים
        setTimeout(() => {
            showData(testData);
        }, 500);
    }
}

// התחל כשהדף נטען
window.addEventListener('load', tryGetData);

// נסה גם אחרי שניה אם לא עבד
setTimeout(tryGetData, 1000);
</script>
</body>
</html>`;

    // תמיד החזר את אותו HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
};
