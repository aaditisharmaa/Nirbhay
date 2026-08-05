const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const CATEGORIES = new Set(['Poor Lighting', 'Harassment', 'Stalking', 'Deserted Area', 'Other']);
const SEVERITIES = new Set(['low', 'medium', 'high']);

export function parseCoordinates(lat, lng) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

export function validatePhone(phone) {
  return typeof phone === 'string' && PHONE_PATTERN.test(phone.replace(/[\s()-]/g, ''));
}

export function normalizePhone(phone) {
  return phone.replace(/[\s()-]/g, '');
}

export function validateReport({ category, severity, description }) {
  if (category && !CATEGORIES.has(category)) return 'Invalid report category.';
  if (severity && !SEVERITIES.has(severity)) return 'Invalid report severity.';
  if (description && (typeof description !== 'string' || description.trim().length > 500)) {
    return 'Description must be 500 characters or fewer.';
  }
  return null;
}
