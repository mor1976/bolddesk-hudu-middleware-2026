// api/both.js - מטפל גם ב-GET וגם ב-POST
let lastData = null; // שומר את הנתונים האחרונים

module.exports = (req, res) => {
    console.log(`${req.method} request received at ${new Date().toISOString()}`);
    
    if (req.method === 'POST') {
        // שמור את הנתונים
        lastData = req.body;
        console.log('POST data saved:', JSON.stringify(lastData));
        
        // החזר אישור
        res.status(200).json({ status: 'ok', received: true });
        
    } else if (req.method === 'GET') {
        // החזר HTML עם הנתונים השמורים
        let html = '';
        
        if (lastData) {
            // נסה למצוא מייל
            const email = lastData?.requester?.EmailId || 
                         lastData?.requester?.email || 
                         lastData?.EmailId ||
                         lastData?.email ||
                         'Unknown';
            
            html = `
                <div style="padding: 10px; font-family: Arial;">
                    <div style="background: #e8f4fd; padding: 10px; border-radius: 5px;">
                        <strong>Customer Info:</strong><br>
                        Email: ${email}<br>
                        Ticket: ${lastData.ticketId || 'N/A'}<br>
                        Time: ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            `;
        } else {
            html = '<div style="padding: 10px;">Waiting for data...</div>';
        }
        
        res.status(200).send(html);
        
    } else {
        res.status(200).send('Method not supported');
    }
};
