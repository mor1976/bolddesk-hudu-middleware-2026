// שמור את זה בקובץ api/debug.js (קובץ חדש!)
// זה endpoint נפרד רק לדיבוג

module.exports = async (req, res) => {
    // מדפיסים הכל ללוגים
    console.log('=================================');
    console.log('DEBUG WEBHOOK RECEIVED');
    console.log('=================================');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query:', JSON.stringify(req.query, null, 2));
    console.log('Body Type:', typeof req.body);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    // אם הbody הוא string, ננסה לפרסר
    let parsedBody = req.body;
    if (typeof req.body === 'string') {
        try {
            parsedBody = JSON.parse(req.body);
            console.log('Parsed Body:', JSON.stringify(parsedBody, null, 2));
        } catch (e) {
            console.log('Could not parse body as JSON');
        }
    }
    
    // מחפשים email בכל מקום אפשרי
    let foundEmails = [];
    
    function searchForEmail(obj, path = '') {
        if (!obj) return;
        
        for (let key in obj) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (key.toLowerCase().includes('email') || 
                key.toLowerCase().includes('mail')) {
                console.log(`Found email field at ${currentPath}:`, obj[key]);
                foundEmails.push({path: currentPath, value: obj[key]});
            }
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                searchForEmail(obj[key], currentPath);
            }
        }
    }
    
    searchForEmail(parsedBody);
    
    console.log('=================================');
    console.log('FOUND EMAILS:', foundEmails);
    console.log('=================================');
    
    // מחזירים תשובה
    res.status(200).json({
        success: true,
        message: 'Debug webhook received',
        foundEmails: foundEmails,
        receivedData: {
            headers: req.headers,
            body: req.body
        }
    });
};
