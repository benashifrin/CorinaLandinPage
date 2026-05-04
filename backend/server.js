const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Sheets configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1xM1IL9IYs_SOag3p4-DFoSwW4h1lqe2iK0ywaByosKA';
const SHEET_NAME = 'Sheet1';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+18664113094';

// Initialize Twilio client
function getTwilioClient() {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.warn('Twilio credentials not configured');
        return null;
    }
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// Initialize Google Sheets API
async function getGoogleSheetsClient() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: 'v4', auth });
}

// Generate unique ID
function generateUniqueId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomPart}`.toUpperCase();
}

// Format phone number to E.164 format
function formatPhoneNumber(phone) {
    if (!phone) return null;
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    // Add +1 if it's a 10-digit US number
    if (digits.length === 10) {
        return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
    }
    return `+${digits}`;
}

// Send SMS notification
async function sendSmsNotification(phone, firstName) {
    const client = getTwilioClient();
    if (!client) {
        console.log('Twilio not configured, skipping SMS');
        return;
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
        console.log('Invalid phone number, skipping SMS');
        return;
    }

    try {
        const message = await client.messages.create({
            body: `Hi ${firstName}! Thank you for your interest in a sleep apnea consultation. You will receive a call shortly from Atanase Smiles at (973) 635-0626 to schedule your $49 consultation. We look forward to speaking with you!`,
            from: TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });
        console.log('SMS sent:', message.sid);
    } catch (error) {
        console.error('Error sending SMS:', error.message);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Form submission endpoint
app.post('/api/submit', async (req, res) => {
    try {
        const {
            cpapStatus,
            sleepStudy,
            sleepApneaSeverity,
            insurance,
            firstName,
            lastName,
            phone,
            email
        } = req.body;

        // Validate required fields
        if (!firstName || (!phone && !email)) {
            return res.status(400).json({
                success: false,
                error: 'First name and at least one contact method (phone or email) are required'
            });
        }

        const sheets = await getGoogleSheetsClient();

        // Prepare row data matching sheet columns:
        // Source | Timestamp | First Name | Last Name | Phone | Email | CPAP Status | Sleep Study | Severity | Insurance | Scheduled? | Reason | Notes | Called | Answered | Texted | Responded Text | Emailed | Responded Email | (empty cols) | ID
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
        const uniqueId = generateUniqueId();
        const rowData = [
            'Landing Page',           // A: Source
            timestamp,                // B: Timestamp
            firstName,                // C: First Name
            lastName || '',           // D: Last Name
            phone || '',              // E: Phone
            email || '',              // F: Email
            cpapStatus || '',         // G: CPAP Status
            sleepStudy || '',         // H: Sleep Study
            sleepApneaSeverity || '', // I: Severity
            insurance || '',          // J: Insurance
            '',                       // K: Scheduled?
            '',                       // L: Reason for Not Scheduling
            '',                       // M: Notes
            '',                       // N: Called
            '',                       // O: Answered Call
            '',                       // P: Texted
            '',                       // Q: Responded to Text?
            '',                       // R: Emailed
            '',                       // S: Responded to Email?
            '',                       // T: (empty)
            '',                       // U: (empty)
            '',                       // V: (empty)
            '',                       // W: (empty)
            '',                       // X: (empty)
            '',                       // Y: (empty)
            uniqueId                  // Z: ID
        ];

        // Append to Google Sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [rowData]
            }
        });

        console.log('Form submission saved:', { firstName, lastName, timestamp, uniqueId });

        // Send SMS notification if phone provided (30 second delay)
        if (phone) {
            setTimeout(() => {
                sendSmsNotification(phone, firstName);
            }, 30000);
        }

        res.json({
            success: true,
            message: 'Form submitted successfully'
        });

    } catch (error) {
        console.error('Error saving form submission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save form submission'
        });
    }
});

// Twilio inbound SMS webhook
app.post('/sms/inbound', (req, res) => {
    const { From, Body } = req.body;
    console.log('Inbound SMS from:', From, 'Body:', Body);

    // Respond with TwiML (empty response)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
