const API_BASE = 'http://localhost:8000';

/**
 * Shorten a long URL.
 * POST /shorten  →  { short_code, short_url }
 */
export async function shortenUrl(longUrl) {
  const response = await fetch(`${API_BASE}/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ long_url: longUrl }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Server responded with ${response.status}`);
  }

  return response.json();
}

/**
 * Get link info (short_url, long_url) for a short code.
 * GET /analytics/{short_code}/info  →  { short_code, short_url, long_url }
 */
export async function getLinkInfo(shortCode) {
  const response = await fetch(`${API_BASE}/analytics/${shortCode}/info`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Server responded with ${response.status}`);
  }

  return response.json();
}

/**
 * Get total click count for a short code.
 * GET /analytics/{short_code}/total  →  { short_code, clicks }
 */
export async function getTotalClicks(shortCode) {
  const response = await fetch(`${API_BASE}/analytics/${shortCode}/total`);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Server responded with ${response.status}`);
  }

  return response.json();
}

/**
 * Get daily click counts for a short code.
 * GET /analytics/{short_code}/daily  →  [{ date, clicks }, ...]
 */
export async function getDailyClicks(shortCode, fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);

  const query = params.toString();
  const url = `${API_BASE}/analytics/${shortCode}/daily${query ? `?${query}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || `Server responded with ${response.status}`);
  }

  return response.json();
}
