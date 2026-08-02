import dotenv from 'dotenv';
import db from '../db.js';

dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

/**
 * Trigger context-aware SOS alert message via Twilio (or smart simulator)
 */
export async function sendSosAlert({ userId, lat, lng, zoneRiskInfo, emergencyContact, customMessageBody }) {
  let messageBody = customMessageBody;

  if (!messageBody) {
    if (zoneRiskInfo && zoneRiskInfo.level === 'High') {
      const topFactors = Object.keys(zoneRiskInfo.categoryCounts || {}).join(', ') || 'poor lighting and past incidents';
      messageBody = `🚨 NIRBHAY EMERGENCY ALERT: Your contact needs immediate assistance! Location: https://maps.google.com/?q=${lat},${lng}. Alerted in KNOWN HIGH-RISK ZONE (${zoneRiskInfo.score}/100 Risk). Factors: ${topFactors}. Please reach out immediately!`;
    } else {
      messageBody = `🚨 NIRBHAY EMERGENCY ALERT: Your contact needs immediate assistance! Live Location: https://maps.google.com/?q=${lat},${lng}. Stay alert and contact them or emergency services!`;
    }
  }

  let smsSent = false;
  let providerResponse = 'Simulated dispatch';

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER && emergencyContact) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: emergencyContact,
        From: TWILIO_PHONE_NUMBER,
        Body: messageBody
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: bodyParams
      });

      const resData = await response.json();
      if (response.ok) {
        smsSent = true;
        providerResponse = `Twilio SID: ${resData.sid}`;
        console.log(`📲 Live Twilio SMS sent to ${emergencyContact}: SID ${resData.sid}`);
      } else {
        console.warn('⚠️ Twilio SMS API response error:', resData.message);
        providerResponse = `Twilio Error: ${resData.message}`;
      }
    } catch (err) {
      console.warn('⚠️ Twilio dispatch exception:', err.message);
      providerResponse = `Exception: ${err.message}`;
    }
  } else {
    console.log(`📱 [SIMULATED SMS DISPATCH] To: ${emergencyContact || 'Default Emergency Contact'} | Message: "${messageBody}"`);
    smsSent = true;
  }

  // Log SOS event in database
  const alertId = `sos_${Date.now()}`;
  db.prepare(`
    INSERT INTO sos_alerts (id, user_id, lat, lng, risk_level, recipient_phone, message_content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(alertId, userId || 'anon_user', lat, lng, zoneRiskInfo ? zoneRiskInfo.level : 'Unknown', emergencyContact || 'Default Contact', messageBody);

  return {
    success: true,
    smsSent,
    providerResponse,
    messageBody,
    simulatedPoliceAlert: 'Alerting nearest authorities... (Simulated Demo State)'
  };
}
