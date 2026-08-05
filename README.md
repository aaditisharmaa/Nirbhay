# Nirbhay

Nirbhay is a community-informed women’s safety map. It supports anonymous public reporting, risk-zone visualization, safer-route comparison, and emergency SMS alerts to a saved trusted contact.

## Run locally

1. Copy `.env.example` to `.env` and configure Firebase and Twilio.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

For local visual development without Firebase, set `ALLOW_DEVELOPMENT_AUTH=true`. This is intentionally rejected in production.

## Production safety requirements

- Configure Firebase web credentials and `FIREBASE_SERVICE_ACCOUNT_JSON`; the API verifies Firebase ID tokens before accepting reports, confirmations, contact changes, or SOS requests.
- Configure Twilio credentials. If Twilio is missing or rejects a request, Nirbhay does not claim that an SOS SMS was sent.
- Set `CLIENT_ORIGIN` to the deployed frontend URL and leave `SEED_DATA=false` to avoid publishing demo reports.
- Risk scores are community-informed signals, not a guarantee of personal safety or an emergency-service dispatch system.

## Emergency guidance

In immediate danger, contact local emergency services directly. Nirbhay can help share a location with a trusted contact, but it must not be relied upon as a substitute for emergency services.
