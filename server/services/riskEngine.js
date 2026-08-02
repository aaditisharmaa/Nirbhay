import db from '../db.js';
import { getHaversineDistanceKm } from './osmService.js';

// Cell size: ~150 meters in lat/lng
export const CELL_LAT_SIZE = 0.00135;
export const CELL_LNG_SIZE = 0.00155;

/**
 * Universal dynamic cell_id calculation for any coordinates across India / global
 */
export function getCellId(lat, lng) {
  const latIndex = Math.floor(lat / CELL_LAT_SIZE);
  const lngIndex = Math.floor(lng / CELL_LNG_SIZE);
  return `cell_${latIndex}_${lngIndex}`;
}

/**
 * Universal cell center coordinates calculation
 */
export function getCellCenter(cellId) {
  const parts = cellId.split('_');
  const latIdx = parseInt(parts[1], 10);
  const lngIdx = parseInt(parts[2], 10);
  return {
    lat: (latIdx + 0.5) * CELL_LAT_SIZE,
    lng: (lngIdx + 0.5) * CELL_LNG_SIZE
  };
}

/**
 * Universal function to compute risk scores for active grid cells nationwide
 */
export function computeAllGridScores(osmFeatures = { streetlights: [], policeStations: [], isolatedWays: [] }) {
  const reports = db.prepare('SELECT * FROM reports').all();
  const upvotes = db.prepare('SELECT * FROM upvotes').all();

  const upvoteCounts = {};
  upvotes.forEach(u => {
    upvoteCounts[u.report_id] = (upvoteCounts[u.report_id] || 0) + 1;
  });

  const now = new Date().getTime();
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const activeCellsMap = new Map();

  const getOrCreateCell = (cellId, centerLat, centerLng) => {
    if (!activeCellsMap.has(cellId)) {
      activeCellsMap.set(cellId, {
        cellId,
        centerLat,
        centerLng,
        reports: [],
        overlappingReportsCount: 0,
        severityScoreSum: 0,
        recencyDensityScore: 0,
        recentSpikeCount: 0,
        reportsIn2h: 0
      });
    }
    return activeCellsMap.get(cellId);
  };

  // 1. Process Reports with Spatial Influence Radius
  reports.forEach(rep => {
    const repLat = rep.lat;
    const repLng = rep.lng;
    const repTime = new Date(rep.created_at).getTime();
    const msOld = Math.max(0, now - repTime);
    const daysOld = msOld / (1000 * 60 * 60 * 24);
    
    const recencyFactor = Math.exp(-0.05 * daysOld);

    let sevWeight = 0.3;
    let radiusKm = 0.06; // 60m
    if (rep.severity === 'medium') {
      sevWeight = 0.6;
      radiusKm = 0.10; // 100m
    } else if (rep.severity === 'high') {
      sevWeight = 1.0;
      radiusKm = 0.15; // 150m
    }

    const upvotesOnRep = (upvoteCounts[rep.id] || 0) + (rep.confirm_count || 0);
    let totalRepWeight = (sevWeight + upvotesOnRep * 0.15) * recencyFactor;

    // Down-weight spam reports by 85% instead of suppressing them entirely
    if (rep.is_likely_spam) {
      totalRepWeight *= 0.15;
    }

    const is2hSpike = msOld <= TWO_HOURS_MS;

    const latSpan = Math.ceil(radiusKm / 0.111);
    const lngSpan = Math.ceil(radiusKm / 0.111);

    const baseLatIdx = Math.floor(repLat / CELL_LAT_SIZE);
    const baseLngIdx = Math.floor(repLng / CELL_LNG_SIZE);

    for (let dLat = -latSpan; dLat <= latSpan; dLat++) {
      for (let dLng = -lngSpan; dLng <= lngSpan; dLng++) {
        const lIdx = baseLatIdx + dLat;
        const lgIdx = baseLngIdx + dLng;
        const cLat = (lIdx + 0.5) * CELL_LAT_SIZE;
        const cLng = (lgIdx + 0.5) * CELL_LNG_SIZE;

        const distKm = getHaversineDistanceKm(repLat, repLng, cLat, cLng);
        if (distKm <= radiusKm) {
          const cId = `cell_${lIdx}_${lgIdx}`;
          const cellObj = getOrCreateCell(cId, cLat, cLng);

          const spatialDecay = 1 - (distKm / radiusKm);
          const effectiveWeight = totalRepWeight * spatialDecay;

          cellObj.overlappingReportsCount += 1;
          cellObj.severityScoreSum += effectiveWeight;
          cellObj.recencyDensityScore += effectiveWeight;

          if (is2hSpike) {
            cellObj.reportsIn2h += 1;
          }

          if (distKm <= 0.1) {
            cellObj.reports.push({ ...rep, distanceKm: distKm, upvotes: upvotesOnRep });
          }
        }
      }
    }
  });

  const scoredZones = [];

  activeCellsMap.forEach((cell) => {
    let streetlightsInCell = 0;
    osmFeatures.streetlights.forEach(sl => {
      const d = getHaversineDistanceKm(cell.centerLat, cell.centerLng, sl.lat, sl.lng);
      if (d <= 0.15) streetlightsInCell += 1;
    });

    let minPoliceDistKm = 5.0;
    osmFeatures.policeStations.forEach(ps => {
      const d = getHaversineDistanceKm(cell.centerLat, cell.centerLng, ps.lat, ps.lng);
      if (d < minPoliceDistKm) minPoliceDistKm = d;
    });

    let hasIsolatedWay = false;
    osmFeatures.isolatedWays.forEach(iw => {
      const d = getHaversineDistanceKm(cell.centerLat, cell.centerLng, iw.lat, iw.lng);
      if (d <= 0.12) hasIsolatedWay = true;
    });

    // Score calculations
    const reportScore = Math.min(50, cell.recencyDensityScore * 18);

    let lightingScore = 20;
    if (streetlightsInCell >= 5) lightingScore = 2;
    else if (streetlightsInCell >= 2) lightingScore = 8;
    else if (streetlightsInCell === 1) lightingScore = 14;

    let policeScore = 15;
    if (minPoliceDistKm < 0.5) policeScore = 2;
    else if (minPoliceDistKm < 1.5) policeScore = 6;
    else if (minPoliceDistKm < 3.0) policeScore = 10;

    const isolationScore = hasIsolatedWay ? 15 : 3;

    let totalScore = Math.round(reportScore + lightingScore + policeScore + isolationScore);
    totalScore = Math.max(5, Math.min(100, totalScore));

    let riskLevel = 'Low';
    if (totalScore > 65) riskLevel = 'High';
    else if (totalScore > 35) riskLevel = 'Moderate';

    // Anomaly detection: ONLY trigger when reportsIn2h > 0 AND meaningful spike above baseline
    const isAnomaly = cell.reportsIn2h >= 2 && cell.overlappingReportsCount >= 3;

    // Aggregate category counts
    const categoryCounts = {};
    cell.reports.forEach(r => {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    });

    let locationName = 'Community Risk Zone';
    if (cell.reports.length > 0 && cell.reports[0].description) {
      locationName = cell.reports[0].description.split('near')[1] || cell.reports[0].description.split('at')[1] || locationName;
      if (typeof locationName === 'string') {
        locationName = locationName.split('.')[0].trim();
      }
    }

    scoredZones.push({
      cellId: cell.cellId,
      lat: cell.centerLat,
      lng: cell.centerLng,
      score: totalScore,
      riskLevel,
      reportCount: cell.overlappingReportsCount,
      reportsIn2h: cell.reportsIn2h,
      isAnomaly,
      streetlightsCount: streetlightsInCell,
      nearestPoliceDistKm: parseFloat(minPoliceDistKm.toFixed(2)),
      hasIsolatedWay,
      categoryCounts,
      locationName: locationName || 'Safety Risk Area',
      reports: cell.reports
    });
  });

  return scoredZones;
}

/**
 * Returns point risk status for live location
 */
export function getPointRiskStatus(lat, lng, gridZones = []) {
  if (!gridZones || gridZones.length === 0) {
    return { score: 15, level: 'Low', zone: null };
  }

  let nearestZone = null;
  let minDistanceKm = 999;

  gridZones.forEach(z => {
    const distKm = getHaversineDistanceKm(lat, lng, z.lat, z.lng);
    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
      nearestZone = z;
    }
  });

  if (nearestZone && minDistanceKm <= 0.3) {
    return {
      score: nearestZone.score,
      level: nearestZone.riskLevel,
      zone: nearestZone,
      distanceKm: minDistanceKm
    };
  }

  return { score: 15, level: 'Low', zone: null, distanceKm: minDistanceKm };
}
