import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { seedDatabase } from '../seed.js';
import { computeAllGridScores, getCellId, getPointRiskStatus } from '../services/riskEngine.js';
import { syncOsmData } from '../services/osmService.js';
import { isDaytimeForDistrict, warmSunriseSunsetCache } from '../services/sunriseSunsetService.js';
import {
  classifyReportText,
  explainZoneScoreDetailed,
  generateAnomalySummary,
  generateRouteSummaryAi,
  generateNearbySummary,
  generateProximityAlertAi,
  generateContextualSosAi
} from '../services/aiService.js';
import { getScoredRoutes } from '../services/routerService.js';
import { sendSosAlert } from '../services/smsService.js';
import { requireAuthenticatedUser } from '../middleware/auth.js';
import { parseCoordinates, validateReport } from '../middleware/validation.js';
import { NCRB_DISTRICT_MULTIPLIERS } from '../services/riskEngine.js';

const router = express.Router();

// Cache spatial features in memory
let cachedOsmFeatures = { streetlights: [], policeStations: [], isolatedWays: [] };

// Pre-resolved day/night state per district — refreshed every 30 minutes
let cachedDaytimeByDistrict = new Map();
let lastDaytimeRefresh = 0;
const DAYTIME_CACHE_MS = 30 * 60 * 1000; // 30 minutes

async function refreshDaytimeContext() {
  const now = Date.now();
  if (now - lastDaytimeRefresh < DAYTIME_CACHE_MS) return cachedDaytimeByDistrict;
  try {
    const districts = Object.keys(NCRB_DISTRICT_MULTIPLIERS).filter(d => d !== 'default');
    const results = await Promise.allSettled(
      districts.map(async d => ({ district: d, isDaytime: await isDaytimeForDistrict(d) }))
    );
    const fresh = new Map();
    results.forEach(r => {
      if (r.status === 'fulfilled') fresh.set(r.value.district, r.value.isDaytime);
    });
    cachedDaytimeByDistrict = fresh;
    lastDaytimeRefresh = now;
    return fresh;
  } catch (err) {
    console.warn('Daytime context refresh failed:', err.message);
    return cachedDaytimeByDistrict;
  }
}

// Public map data must not expose a reporter's free-text description or identity.
function toPublicZone(zone) {
  return {
    ...zone,
    reports: (zone.reports ?? []).map(({ id, category, severity, confirm_count, created_at }) => ({
      id,
      category,
      severity,
      confirm_count,
      created_at
    }))
  };
}

// Initialize OSM spatial features and sunrise/sunset cache on startup
syncOsmData().then(features => {
  cachedOsmFeatures = features;
  console.log('✅ OSM spatial features initialized.');
}).catch(err => console.warn('OSM init warning:', err));

warmSunriseSunsetCache().catch(() => {});

// GET /api/zones - Fetch all computed grid zones with risk scores & heatmap points
router.get('/zones', async (req, res) => {
  try {
    const daytimeByDistrict = await refreshDaytimeContext();
    const zones = computeAllGridScores(cachedOsmFeatures, { daytimeByDistrict });
    
    // Format heatmap points: [lat, lng, intensity]
    const heatmapPoints = zones.map(z => [
      z.lat,
      z.lng,
      Math.max(0.1, z.score / 100)
    ]);

    res.json({
      success: true,
      totalZones: zones.length,
      zones: zones.map(toPublicZone),
      heatmapPoints
    });
  } catch (err) {
    console.error('Error fetching zones:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/zones/:id & /api/zone-explain/:id - Detailed Zone Info + AI Explainer + AI Confidence %
router.get('/zone-explain/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const daytimeByDistrict = await refreshDaytimeContext();
    const zones = computeAllGridScores(cachedOsmFeatures, { daytimeByDistrict });
    const targetZone = zones.find(z => z.cellId === id);

    if (!targetZone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    // Compute AI Model Confidence % locally (30% to 95% scale based on data volume)
    const reportCount = targetZone.reports.length;
    const upvoteCount = targetZone.reports.reduce((acc, r) => acc + (r.confirm_count || 0), 0);
    const lightBonus = targetZone.streetlightsCount > 0 ? 10 : 0;
    const policeBonus = targetZone.nearestPoliceDistKm < 2.0 ? 10 : 0;
    
    const confidencePercent = Math.min(95, Math.max(30, 30 + (reportCount * 12) + (upvoteCount * 5) + lightBonus + policeBonus));

    // Call Claude AI for detailed JSON explanation & contributing factors
    const aiDetails = await explainZoneScoreDetailed(targetZone);

    res.json({
      success: true,
      zone: {
        ...toPublicZone(targetZone),
        confidencePercent,
        explanation: aiDetails.explanation,
        contributing_factors: aiDetails.contributing_factors
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint alias for backward compatibility
router.get('/zones/:id', async (req, res) => {
  req.url = `/zone-explain/${req.params.id}`;
  return router.handle(req, res);
});

// Feature 2: GET /api/alerts - Reverse-chronological list of recent reports with LIVE/Verified/Pending badges
router.get('/alerts', (req, res) => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 30').all();
    const nowMs = Date.now();

    const alerts = reports.map(r => {
      const createdMs = new Date(r.created_at).getTime();
      const minsAgo = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60)));

      let statusBadge = 'Pending';
      if (minsAgo <= 30) {
        statusBadge = 'LIVE';
      } else if (r.confirm_count > 0) {
        statusBadge = 'Verified';
      }

      // Format time-ago text
      let timeAgoText = `${minsAgo} min ago`;
      if (minsAgo >= 60) {
        const hoursAgo = Math.floor(minsAgo / 60);
        timeAgoText = `${hoursAgo} hr${hoursAgo > 1 ? 's' : ''} ago`;
      }

      // Generic location name fallback based on coordinates
      let locationName = 'Delhi Region';
      if (r.lat > 28.63) locationName = 'Connaught Place Area';
      else if (r.lat < 28.56 && r.lng < 77.21) locationName = 'Hauz Khas Village';
      else if (r.lat < 28.58 && r.lng > 77.23) locationName = 'Lajpat Nagar Market';
      else if (r.lat > 28.64) locationName = 'Karol Bagh Area';
      else if (r.lat < 28.53) locationName = 'Mehrauli Park Stretch';

      return {
        id: r.id,
        category: r.category,
        severity: r.severity,
      description: `${r.category} reported near ${locationName}`,
        locationName,
        lat: r.lat,
        lng: r.lng,
        zone_id: r.zone_id,
        statusBadge,
        confirm_count: r.confirm_count || 0,
        timeAgoText,
        created_at: r.created_at
      };
    });

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature 3: GET /api/anomalies - Surface unusual report spikes + AI summary
router.get('/anomalies', async (req, res) => {
  try {
    const zones = computeAllGridScores(cachedOsmFeatures);
    const anomalyZones = zones.filter(z => z.isAnomaly);

    const anomaliesWithAi = await Promise.all(
      anomalyZones.map(async z => {
        let locationName = 'Delhi Region';
        if (z.lat > 28.63) locationName = 'Connaught Place';
        else if (z.lat < 28.56 && z.lng < 77.21) locationName = 'Hauz Khas Village';
        else if (z.lat < 28.58 && z.lng > 77.23) locationName = 'Lajpat Nagar Market';

        const aiSummary = await generateAnomalySummary({ ...z, locationName });
        return {
          ...toPublicZone(z),
          locationName,
          aiSummary
        };
      })
    );

    res.json({ success: true, anomalies: anomaliesWithAi });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature 2 Pass 2: POST /api/nearby-summary - Generate AI summary line for nearby hazards
router.post('/nearby-summary', async (req, res) => {
  try {
    const { nearbyCount, maxRiskLevel, topCategory } = req.body;
    const summary = await generateNearbySummary({ nearbyCount, maxRiskLevel, topCategory });
    res.json({ success: true, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/live-status - Get live risk level for user's lat/lng
router.get('/live-status', async (req, res) => {
  try {
    const coordinates = parseCoordinates(req.query.lat, req.query.lng);
    if (!coordinates) return res.status(400).json({ error: 'lat and lng required' });
    const daytimeByDistrict = await refreshDaytimeContext();
    const zones = computeAllGridScores(cachedOsmFeatures, { daytimeByDistrict });
    const status = getPointRiskStatus(coordinates.lat, coordinates.lng, zones);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports - Submit a new report with AI classification
router.post('/reports', requireAuthenticatedUser, async (req, res) => {
  try {
    const { lat, lng, category: inputCategory, severity: inputSeverity, description } = req.body;
    const coordinates = parseCoordinates(lat, lng);
    const validationError = validateReport({ category: inputCategory, severity: inputSeverity, description });

    if (!coordinates) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }
    if (validationError) return res.status(400).json({ error: validationError });

    let finalCategory = inputCategory;
    let finalSeverity = inputSeverity;
    let aiResult = null;

    if (!finalCategory || !finalSeverity || (description && description.trim().length > 5)) {
      aiResult = await classifyReportText(description);
      if (!finalCategory || finalCategory === 'Other') finalCategory = aiResult.category;
      if (!finalSeverity) finalSeverity = aiResult.severity;
    }

    const reportId = `rep_${crypto.randomUUID()}`;
    const zoneId = getCellId(coordinates.lat, coordinates.lng);

    db.prepare(`
      INSERT INTO reports (id, user_id, lat, lng, category, severity, description, zone_id, is_likely_spam)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      req.user.uid,
      coordinates.lat,
      coordinates.lng,
      finalCategory || 'Other',
      finalSeverity || 'medium',
      description || '',
      zoneId,
      aiResult?.is_likely_spam ? 1 : 0
    );

    const updatedZones = computeAllGridScores(cachedOsmFeatures);
    const newZone = updatedZones.find(z => z.cellId === zoneId);

    res.json({
      success: true,
      reportId,
      classifiedCategory: finalCategory,
      classifiedSeverity: finalSeverity,
      zone: newZone,
      message: 'Report submitted successfully. Your identity is kept 100% private.'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/confirm - Upvote a report (1 per user)
router.post('/reports/:id/confirm', requireAuthenticatedUser, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    if (!report) return res.status(404).json({ error: 'Report not found.' });

    const upvoteId = `up_${crypto.randomUUID()}`;
    try {
      db.prepare('INSERT INTO upvotes (id, report_id, user_id) VALUES (?, ?, ?)').run(upvoteId, id, userId);
      db.prepare('UPDATE reports SET confirm_count = confirm_count + 1 WHERE id = ?').run(id);
    } catch (dbErr) {
      return res.status(400).json({ error: 'You have already confirmed this report.' });
    }

    const updatedReport = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);

    res.json({
      success: true,
      confirmCount: updatedReport ? updatedReport.confirm_count : 1,
      message: 'Report confirmed! Your feedback strengthens zone risk accuracy.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature 4: POST /api/routes - Calculate and score safe routes with AI summary
router.post('/routes', async (req, res) => {
  try {
    const { origin, destination, travelMode = 'walking' } = req.body;
    const validOrigin = origin && parseCoordinates(origin.lat, origin.lng);
    const validDestination = destination && parseCoordinates(destination.lat, destination.lng);
    if (!validOrigin || !validDestination) {
      return res.status(400).json({ error: 'Origin and destination coordinates required' });
    }
    if (!['walking', 'vehicle'].includes(travelMode)) return res.status(400).json({ error: 'Invalid travel mode.' });

    const zones = computeAllGridScores(cachedOsmFeatures);
    const routeResult = await getScoredRoutes(validOrigin, validDestination, zones, travelMode);

    if (!routeResult.success) {
      return res.status(404).json(routeResult);
    }

    const safeRoute = routeResult.routes.find(r => r.id === routeResult.safeRouteId) ?? routeResult.routes[0];
    const fastestRoute = routeResult.routes.find(r => r.id === routeResult.fastestRouteId) ?? routeResult.routes[0];

    // Call Claude AI for 1-line route comparison summary
    const aiSummary = await generateRouteSummaryAi(safeRoute, fastestRoute);

    res.json({
      ...routeResult,
      aiSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature 3: POST /api/proximity-ai - Generate context-aware proximity alert text via Claude API
router.post('/proximity-ai', async (req, res) => {
  try {
    const { distanceMeters, zoneName, topFactor, timeOfDay } = req.body;
    const alertMessage = await generateProximityAlertAi({ distanceMeters, zoneName, topFactor, timeOfDay });
    res.json({ success: true, alertMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature 4: POST /api/sos - Trigger emergency SOS alert with contextual AI message
router.post('/sos', requireAuthenticatedUser, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const coordinates = parseCoordinates(lat, lng);
    if (!coordinates) {
      return res.status(400).json({ error: 'Live location coordinates required' });
    }
    const userId = req.user.uid;

    const user = db.prepare('SELECT emergency_contact FROM users WHERE id = ?').get(userId);
    const emergencyContact = user ? user.emergency_contact : null;
    if (!emergencyContact) {
      return res.status(400).json({ error: 'Add an emergency contact before sending an SOS.' });
    }

    const zones = computeAllGridScores(cachedOsmFeatures);
    const pointStatus = getPointRiskStatus(coordinates.lat, coordinates.lng, zones);
    const mapUrl = `https://maps.google.com/?q=${coordinates.lat},${coordinates.lng}`;

    let locationName = 'Delhi Region';
    if (coordinates.lat > 28.63) locationName = 'Connaught Place Area';
    else if (coordinates.lat < 28.56 && coordinates.lng < 77.21) locationName = 'Hauz Khas Village';
    else if (coordinates.lat < 28.58 && coordinates.lng > 77.23) locationName = 'Lajpat Nagar';
    else if (coordinates.lat < 28.53) locationName = 'Mehrauli Stretch';

    const topFactor = pointStatus.zone ? Object.keys(pointStatus.zone.categoryCounts || {})[0] : 'Safety Hazard';
    const customMessageBody = await generateContextualSosAi({
      locationName,
      riskLevel: pointStatus.level,
      reportCount: pointStatus.zone ? pointStatus.zone.reportCount : 0,
      topFactor,
      mapUrl
    });

    const sosResult = await sendSosAlert({
      userId,
      lat: coordinates.lat,
      lng: coordinates.lng,
      zoneRiskInfo: pointStatus.zone,
      emergencyContact,
      customMessageBody
    });

    if (!sosResult.smsSent) {
      return res.status(503).json({ success: false, error: 'SOS was logged, but the SMS provider did not accept the alert. Call local emergency services now.', ...sosResult });
    }
    res.json({ success: true, ...sosResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/community-alert — broadcast a "feeling unsafe" alert to nearby users
router.post('/community-alert', requireAuthenticatedUser, (req, res) => {
  try {
    const { lat, lng, message } = req.body;
    const coordinates = parseCoordinates(lat, lng);
    if (!coordinates) return res.status(400).json({ error: 'Location coordinates required.' });

    const safeMessage = (message || 'I am feeling unsafe in this area. Please stay alert.').slice(0, 200);
    const id = `ca_${crypto.randomUUID()}`;

    db.prepare(`
      INSERT INTO community_alerts (id, user_id, lat, lng, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.user.uid, coordinates.lat, coordinates.lng, safeMessage);

    res.json({ success: true, id, message: safeMessage });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/community-alerts?lat=&lng= — fetch alerts within 1km posted in last 30 mins
router.get('/community-alerts', (req, res) => {
  try {
    const coordinates = parseCoordinates(req.query.lat, req.query.lng);
    if (!coordinates) return res.status(400).json({ error: 'lat and lng required.' });

    const { lat, lng } = coordinates;
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const alerts = db.prepare(`
      SELECT id, lat, lng, message, created_at
      FROM community_alerts
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(thirtyMinsAgo);

    // Filter to 1km radius using Haversine approximation
    const R = 6371000;
    const nearby = alerts.filter(a => {
      const dLat = (a.lat - lat) * Math.PI / 180;
      const dLng = (a.lng - lng) * Math.PI / 180;
      const sinDLat = Math.sin(dLat / 2);
      const sinDLng = Math.sin(dLng / 2);
      const c = 2 * Math.atan2(
        Math.sqrt(sinDLat * sinDLat + Math.cos(lat * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180) * sinDLng * sinDLng),
        Math.sqrt(1 - sinDLat * sinDLat - Math.cos(lat * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180) * sinDLng * sinDLng)
      );
      return R * c <= 1000;
    });

    res.json({ success: true, alerts: nearby });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seed - Administrative endpoint to force re-seed database with fresh timestamps
router.post('/seed', (req, res) => {
  try {
    seedDatabase(true);
    const zones = computeAllGridScores(cachedOsmFeatures);
    const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get()?.count ?? 0;
    res.json({
      success: true,
      totalReports,
      zonesMapped: zones.length,
      message: 'Database re-seeded successfully with fresh timestamps!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/map-features — returns police station locations for frontend rendering
router.get('/map-features', (req, res) => {
  try {
    const policeStations = (cachedOsmFeatures.policeStations ?? []).map(p => ({
      lat: p.lat,
      lng: p.lng
    }));
    res.json({ success: true, policeStations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats - Public system counters
router.get('/stats', (req, res) => {
  try {
    const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get()?.count ?? 0;
    const zones = computeAllGridScores(cachedOsmFeatures);
    const activeAlerts = db.prepare('SELECT COUNT(*) as count FROM sos_alerts').get()?.count ?? 0;
    res.json({ success: true, totalReports, zonesMapped: zones.length, activeAlerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
