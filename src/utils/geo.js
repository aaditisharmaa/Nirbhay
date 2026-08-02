/**
 * Haversine Distance in meters
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 8-Point Compass Direction from (lat1, lon1) to (lat2, lon2)
 */
export function getCompassDirection(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Trajectory check: Returns true if user's location history shows shrinking distance to target zone
 */
export function isMovingTowards(historyPoints, targetLat, targetLng) {
  if (!historyPoints || historyPoints.length < 2) return false;

  const prevPoint = historyPoints[historyPoints.length - 2];
  const currPoint = historyPoints[historyPoints.length - 1];

  const prevDist = getDistanceMeters(prevPoint.lat, prevPoint.lng, targetLat, targetLng);
  const currDist = getDistanceMeters(currPoint.lat, currPoint.lng, targetLat, targetLng);

  // Distance shrinking by at least 3 meters indicates active movement towards target
  return currDist < prevDist - 3 && currDist <= 200;
}
