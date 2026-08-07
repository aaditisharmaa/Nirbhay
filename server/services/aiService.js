import dotenv from 'dotenv';
dotenv.config();

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

/**
 * Keyword-based classifier fallback for report category, severity, and spam detection
 */
export function classifyReportTextFallback(description) {
  const text = (description || '').toLowerCase().trim();
  
  let category = 'Other';
  if (text.includes('light') || text.includes('dark') || text.includes('lamp') || text.includes('shadow')) {
    category = 'Poor Lighting';
  } else if (text.includes('follow') || text.includes('stalk') || text.includes('shadowed') || text.includes('behind')) {
    category = 'Stalking';
  } else if (text.includes('harass') || text.includes('shout') || text.includes('catcall') || text.includes('comment') || text.includes('tease')) {
    category = 'Harassment';
  } else if (text.includes('desert') || text.includes('empty') || text.includes('isolated') || text.includes('lonely') || text.includes('park')) {
    category = 'Deserted Area';
  }

  let severity = 'low';
  if (text.includes('touch') || text.includes('grab') || text.includes('corner') || text.includes('threat') || text.includes('weapon') || text.includes('follow')) {
    severity = 'high';
  } else if (text.includes('harass') || text.includes('group') || text.includes('dark') || text.includes('shout') || text.includes('uncomfortable')) {
    severity = 'medium';
  }

  // Basic spam heuristic
  let is_likely_spam = false;
  if (text.length > 0 && (text.includes('test') || text.includes('asdf') || text.includes('qwerty') || text.includes('foo') || text.includes('lorem ipsum'))) {
    is_likely_spam = true;
  }

  return { category, severity, is_likely_spam };
}

/**
 * Feature 5: Classify report description & detect spam using Claude API
 */
export async function classifyReportText(description) {
  if (!description || description.trim().length < 4) {
    return classifyReportTextFallback(description);
  }

  if (!CLAUDE_API_KEY) {
    return classifyReportTextFallback(description);
  }

  try {
    const prompt = `Analyze this women's safety incident report text and classify it into category, severity, and detect if it is spam or low-quality/testing input.
Categories: "Poor Lighting", "Harassment", "Stalking", "Deserted Area", "Other".
Severity: "low", "medium", "high".
Spam Check: is_likely_spam = true if the text is gibberish, nonsensical, testing text (e.g. "asdf", "test 123"), or clearly unrelated to safety.

Report Text: "${description}"

Respond strictly with valid JSON only in this exact format:
{"category": "CategoryName", "severity": "low|medium|high", "is_likely_spam": true|false}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text || '';
    const parsed = JSON.parse(rawContent);

    return {
      category: parsed.category || 'Other',
      severity: (parsed.severity || 'medium').toLowerCase(),
      is_likely_spam: Boolean(parsed.is_likely_spam)
    };
  } catch (err) {
    console.warn('⚠️ AI Classification fallback triggered:', err.message);
    return classifyReportTextFallback(description);
  }
}

/**
 * Feature 3: Context-Aware Proximity Alert Generator via Claude API
 */
export async function generateProximityAlertAi({ distanceMeters, zoneName, topFactor, timeOfDay }) {
  const buildFallback = () => `Approaching a high-risk area (${distanceMeters}m ahead) — ${zoneName || 'Risk Zone'}. Stay alert.`;

  if (!CLAUDE_API_KEY) return buildFallback();

  try {
    const prompt = `Write a short 1-sentence context-aware safety warning for a walking user approaching a risk area:
Distance Ahead: ${distanceMeters}m
Area Name: ${zoneName || 'Delhi Region'}
Primary Hazard Signal: ${topFactor || 'poor lighting / deserted stretch'}
Time of Day: ${timeOfDay || 'evening'}

Respond with plain text, one short sentence only (e.g. "Approaching a poorly-lit stretch — consider staying on the main road").`;

    // Timeout safety race promise (1.5 seconds max)
    const apiPromise = fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 1500));
    const response = await Promise.race([apiPromise, timeoutPromise]);

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || buildFallback();
  } catch (err) {
    return buildFallback();
  }
}

/**
 * Feature 4: Context-Aware SOS Message Generator via Claude API
 */
export async function generateContextualSosAi({ locationName, riskLevel, reportCount, topFactor, mapUrl }) {
  const buildFallback = () => `🚨 NIRBHAY EMERGENCY ALERT: Your contact needs immediate assistance near ${locationName}! Live Location: ${mapUrl}. Stay alert and contact emergency services!`;

  if (!CLAUDE_API_KEY) return buildFallback();

  try {
    const prompt = `Write a concise emergency SOS SMS message for an individual in danger:
Location: ${locationName}
Risk Level: ${riskLevel || 'High'}
Reports Count Nearby: ${reportCount || 0}
Top Risk Concern: ${topFactor || 'safety hazard'}
Google Maps URL: ${mapUrl}

Respond with plain text SMS text, max 160 characters (e.g. "🚨 NIRBHAY EMERGENCY: User needs help near Hauz Khas Village — high-risk area, 3 recent harassment reports nearby. Live Location: ${mapUrl}").`;

    const apiPromise = fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 1500));
    const response = await Promise.race([apiPromise, timeoutPromise]);

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || buildFallback();
  } catch (err) {
    return buildFallback();
  }
}

/**
 * Feature 1: Detailed Zone Explainer returning JSON with explanation and 3-4 contributing factors
 */
export async function explainZoneScoreDetailed(zoneData) {
  const { score, riskLevel, reportCount, signals, categoryCounts } = zoneData;

  const buildFallback = () => {
    const factors = [];

    // Community reports
    if (reportCount > 0) factors.push(`${reportCount} recent community safety report${reportCount > 1 ? 's' : ''}`);
    else factors.push('Cold-start zone (public data signals only)');

    // Lighting — mention time-of-day context when available
    if (signals.streetlightsCount < 2) {
      if (signals.isDaytime === false) {
        factors.push('Low streetlight density — elevated nighttime risk (post-sunset)');
      } else if (signals.isDaytime === true) {
        factors.push('Low streetlight density (reduced weight during daylight hours)');
      } else {
        factors.push('Low streetlight density detected');
      }
    } else {
      factors.push(`Standard streetlight coverage (${signals.streetlightsCount} lights within 150m)`);
    }

    // Police proximity
    if (signals.nearestPoliceDistKm > 1.5) factors.push(`Police station ${signals.nearestPoliceDistKm}km away`);
    else factors.push('Proximity to local police station');

    // Isolation
    if (signals.isIsolated) factors.push('Secluded area or park boundary');

    // NCRB baseline — only surface when it meaningfully adjusts the score
    if (signals.ncrbMultiplier && signals.ncrbMultiplier > 1.05 && signals.districtName && signals.districtName !== 'default') {
      factors.push(
        `District crime baseline (NCRB data): ${signals.districtName} district carries a ×${signals.ncrbMultiplier.toFixed(2)} baseline adjustment from government-recorded crime statistics`
      );
    }

    return {
      explanation: `This area is rated as ${riskLevel.toLowerCase()} risk (${score}/100) based on ${reportCount} community report${reportCount !== 1 ? 's' : ''} and public spatial signals.`,
      contributing_factors: factors.slice(0, 5)
    };
  };

  if (!CLAUDE_API_KEY) {
    return buildFallback();
  }

  try {
    const timeContext = signals?.isDaytime === true
      ? 'Daytime — streetlight weight reduced (30% of normal).'
      : signals?.isDaytime === false
        ? 'Nighttime / post-sunset — streetlight weight at full (100%).'
        : 'Time of day unknown.';

    const ncrbContext = (signals?.ncrbMultiplier && signals.ncrbMultiplier > 1.05 && signals?.districtName !== 'default')
      ? `NCRB 2022 district baseline multiplier for ${signals.districtName}: ×${signals.ncrbMultiplier} (government crime data — periodic, not real-time).`
      : 'No significant NCRB district adjustment.';

    const prompt = `Analyze this safety risk zone and generate a 2-line plain-language explanation and 3-5 bullet point contributing factors.
Zone Data:
- Risk Score: ${score}/100 (${riskLevel} Risk)
- Community Reports Count: ${reportCount}
- Report Categories: ${JSON.stringify(categoryCounts || {})}
- Streetlamps Count: ${signals?.streetlightsCount || 0}
- Police Distance: ${signals?.nearestPoliceDistKm || 2.0} km
- Isolated Area: ${signals?.isIsolated ? 'Yes' : 'No'}
- Time Context: ${timeContext}
- Government Data: ${ncrbContext}

If NCRB data is present, include one factor labelled exactly: "District crime baseline (NCRB data): ..." 
Respond strictly with valid JSON only in this exact shape:
{
  "explanation": "2-line plain language explanation of why the zone has this score.",
  "contributing_factors": ["Factor 1", "Factor 2", "Factor 3"]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.content?.[0]?.text || '{}');

    return {
      explanation: parsed.explanation || buildFallback().explanation,
      contributing_factors: Array.isArray(parsed.contributing_factors) && parsed.contributing_factors.length > 0
        ? parsed.contributing_factors
        : buildFallback().contributing_factors
    };
  } catch (err) {
    return buildFallback();
  }
}

/**
 * Feature 3: AI Anomaly Summary Generator
 */
export async function generateAnomalySummary(zoneData) {
  const buildFallback = () => `Sudden increase in safety reports near ${zoneData.locationName || 'this zone'} — possible incident in progress.`;

  if (!CLAUDE_API_KEY) return buildFallback();

  try {
    const prompt = `Generate a 1-sentence urgent AI alert summary for a safety report spike in a zone:
Location: ${zoneData.locationName || 'Delhi region'}
Recent Reports Count: ${zoneData.recentSpikeCount || zoneData.reportCount} in last 2 hours.
Categories: ${JSON.stringify(zoneData.categoryCounts || {})}

Respond strictly with valid JSON only in this exact shape:
{ "summary": "1-sentence urgent alert summary" }`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    const parsed = JSON.parse(data.content?.[0]?.text || '{}');
    return parsed.summary || buildFallback();
  } catch (err) {
    return buildFallback();
  }
}

/**
 * Feature 4: AI Route Comparison Summary
 */
export async function generateRouteSummaryAi(safeRoute, fastestRoute) {
  const buildFallback = () => {
    if (!safeRoute) return "No valid route found.";
    if (!fastestRoute || safeRoute.id === fastestRoute.id) {
      return `Recommended: Safe Route (${safeRoute.durationMins} min) — minimizes high-risk exposure.`;
    }
    const extraMins = Math.max(1, safeRoute.durationMins - fastestRoute.durationMins);
    return `The safe route takes ${extraMins} extra minute${extraMins > 1 ? 's' : ''} but avoids ${fastestRoute.highRiskSegmentCount || 1} high-risk zone — recommended after dark.`;
  };

  if (!CLAUDE_API_KEY) return buildFallback();

  try {
    const prompt = `Compare these two route options and generate a neutral 1-sentence summary favoring safety:
Safe Route: ${safeRoute.durationMins} mins, avg risk ${safeRoute.avgPathRisk}/100.
Fastest Route: ${fastestRoute?.durationMins} mins, passes through ${fastestRoute?.highRiskSegmentCount || 0} high-risk zones.

Respond with plain text, one sentence only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || buildFallback();
  } catch (err) {
    return buildFallback();
  }
}

/**
 * Feature 2 Pass 2: AI Nearby Hazards Summary Generator
 */
export async function generateNearbySummary({ nearbyCount, maxRiskLevel, topCategory }) {
  const buildFallback = () => {
    if (nearbyCount === 0) return "You're in a clear area — no hazard zones reported within 1km.";
    return `You're in a moderately safe area — ${nearbyCount} caution point${nearbyCount > 1 ? 's' : ''} nearby within 1km.`;
  };

  if (!CLAUDE_API_KEY) return buildFallback();

  try {
    const prompt = `Write a short 1-sentence reassurance summary for a user's location based on nearby hazards:
Nearby Risk Zones Count (within 1km): ${nearbyCount}
Highest Nearby Risk Level: ${maxRiskLevel}
Primary Nearby Concern: ${topCategory || 'general safety'}

Respond with plain text, one short sentence only (e.g. "You're in a moderately safe area — 2 caution points nearby, mainly lighting-related").`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`Claude API status ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || buildFallback();
  } catch (err) {
    return buildFallback();
  }
}
