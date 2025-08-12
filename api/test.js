// api/test.js - Test page for webhook
module.exports = (req, res) => {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Test BoldDesk Webhook</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px 5px;
        }
        button:hover {
            opacity: 0.9;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
        }
        .success {
            background: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
        }
        .error {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
        input {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ced4da;
            border-radius: 4px;
        }
        label {
            display: block;
            margin-top: 15px;
            font-weight: bold;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Test BoldDesk-Hudu Webhook</h1>
        
        <label>Customer Email:</label>
        <input type="email" id="email" value="mormoria5@gmail.com">
        
        <label>Ticket ID:</label>
        <input type="number" id="ticketId" value="99999">
        
        <label>Ticket Subject:</label>
        <input type="text" id="subject" value="Test Ticket">
        
        <br><br>
        
        <button onclick="testSimple()">📤 Test Simple</button>
        <button onclick="testFull()">📋 Test Full Format</button>
        <button onclick="testRealTicket()">🎫 Test with Real Ticket ID</button>
        
        <div id="result" class="result"></div>
    </div>

    <script>
        const webhookUrl = '/bolddesk-webhook';
        
        async function testSimple() {
            const resultDiv = document.getElementById('result');
            const email = document.getElementById('email').value;
            
            resultDiv.className = 'result';
            resultDiv.textContent = 'Sending simple test...';
            
            const data = {
                ticketId: 12345,
                subject: "Simple Test",
                requester: {
                    EmailId: email
                }
            };
            
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                resultDiv.className = result.success ? 'result success' : 'result error';
                resultDiv.textContent = JSON.stringify(result, null, 2);
                
                if (result.data?.huduAsset?.found) {
                    resultDiv.textContent += '\\n\\n✅ CUSTOMER FOUND IN HUDU!';
                }
                
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
            }
        }
        
        async function testFull() {
            const resultDiv = document.getElementById('result');
            const email = document.getElementById('email').value;
            const ticketId = parseInt(document.getElementById('ticketId').value);
            const subject = document.getElementById('subject').value;
            
            resultDiv.className = 'result';
            resultDiv.textContent = 'Sending full format test...';
            
            const data = {
                "ticketId": ticketId,
                "subject": subject,
                "brand": {
                    "Id": 1,
                    "Name": "GET-MOR"
                },
                "category": {
                    "Id": 4,
                    "Name": "Computer"
                },
                "priority": {
                    "Id": 2,
                    "Name": "Normal"
                },
                "status": {
                    "Id": 1,
                    "Name": "New"
                },
                "requester": {
                    "UserId": 1002,
                    "DisplayName": "Test User",
                    "EmailId": email
                },
                "contactGroup": {
                    "Id": 1,
                    "Name": "Test Company"
                },
                "customFields": {
                    "cf_domain_365": "test.co.il"
                }
            };
            
            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                resultDiv.className = result.success ? 'result success' : 'result error';
                resultDiv.textContent = JSON.stringify(result, null, 2);
                
                if (result.data?.bolddeskUpdated) {
                    resultDiv.textContent += '\\n\\n✅ BOLDDESK TICKET UPDATED!';
                }
                
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
            }
        }
        
        async function testRealTicket() {
            const ticketId = prompt('Enter a real BoldDesk ticket ID:');
            if (!ticketId) return;
            
            document.getElementById('ticketId').value = ticketId;
            testFull();
        }
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
};
