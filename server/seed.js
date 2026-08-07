import db from './db.js';
import { getCellId } from './services/riskEngine.js';

export function seedDatabase(forceReSeed = false) {
  let existingCount = 0;
  try {
    const res = db.prepare('SELECT COUNT(*) as cnt FROM reports').get();
    existingCount = res ? (res.cnt || res.count || 0) : 0;
  } catch (e) {
    existingCount = 0;
  }

  let isOutdated = false;
  if (existingCount > 0) {
    try {
      const latestReport = db.prepare('SELECT created_at FROM reports ORDER BY created_at DESC LIMIT 1').get();
      if (latestReport && latestReport.created_at) {
        const msOld = Date.now() - new Date(latestReport.created_at).getTime();
        if (msOld > 2 * 24 * 60 * 60 * 1000) {
          isOutdated = true;
          console.log(`ℹ️ Seed data is ${Math.round(msOld / (1000 * 3600 * 24))} days old. Auto-refreshing timestamps...`);
        }
      }
    } catch (e) {}
  }

  if (existingCount >= 800 && !forceReSeed && !isOutdated) {
    console.log(`ℹ️ Database already seeded with ${existingCount} fresh national safety reports.`);
    return;
  }

  if (forceReSeed || isOutdated || existingCount < 800) {
    console.log('🧹 Clearing & generating fresh nationwide multi-state seed dataset...');
    try {
      db.prepare('DELETE FROM reports').run();
      db.prepare('DELETE FROM upvotes').run();
    } catch (e) {}
  }

  console.log('🌱 Generating national safety report dataset (~950 reports across Uttar Pradesh + 8 Major Indian Cities)...');

  const nowMs = Date.now();

  const getEveningTimestamp = (daysAgo, hourOffset = 0) => {
    const d = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000);
    d.setHours(18 + (hourOffset % 5), (hourOffset * 19) % 60, 0, 0);
    return d.toISOString();
  };

  // PRIORITY 1 — UTTAR PRADESH (38 SEED TEMPLATES -> ~420 REPORTS ACROSS 18 CITIES/HUBS)
  const upSeedTemplates = [
    // 1. GLA UNIVERSITY, MATHURA (LIVE DEMO PRIORITY 1!)
    { lat: 27.6048, lng: 77.5971, category: 'Poor Lighting', severity: 'high', desc: 'Streetlamp near GLA University Gate 2 out for 2 weeks. Very dark walk to hostel.' },
    { lat: 27.6055, lng: 77.5982, category: 'Harassment', severity: 'high', desc: 'Aggressive loitering near GLA campus entry junction shouting catcalls at evening.' },
    { lat: 27.6038, lng: 77.5960, category: 'Stalking', severity: 'high', desc: 'Followed along dark service lane connecting GLA campus to main highway.' },
    { lat: 27.6062, lng: 77.5995, category: 'Deserted Area', severity: 'high', desc: 'Secluded walkway near GLA sports complex perimeter with zero lighting.' },
    { lat: 27.6042, lng: 77.5950, category: 'Poor Lighting', severity: 'medium', desc: 'Broken street lamps near student food stalls lane.' },
    { lat: 27.6070, lng: 77.6010, category: 'Harassment', severity: 'medium', desc: 'Group catcalling near bus stop opposite GLA main gate.' },
    { lat: 27.6032, lng: 77.5945, category: 'Stalking', severity: 'high', desc: 'Bike riders following slow near GLA girls hostel rear exit.' },

    // 2. MATHURA CITY & KRISHNA JANMABHOOMI STRETCH
    { lat: 27.4924, lng: 77.6737, category: 'Poor Lighting', severity: 'medium', desc: 'Narrow heritage lane near Janmabhoomi rear exit dark after 8 PM.' },
    { lat: 27.4950, lng: 77.6750, category: 'Harassment', severity: 'high', desc: 'Verbal harassment by auto drivers crowding near railway station lane.' },
    { lat: 27.4900, lng: 77.6710, category: 'Deserted Area', severity: 'high', desc: 'Yamuna ghat approach road unlit and deserted at night.' },
    { lat: 27.5650, lng: 77.6590, category: 'Poor Lighting', severity: 'high', desc: 'Dark stretch near Vrindavan Mathura bypass intersection.' },

    // 3. NOIDA SECTOR 18 & ATTA MARKET
    { lat: 28.5700, lng: 77.3250, category: 'Harassment', severity: 'medium', desc: 'Catcalling near metro station gate 2 crowded stairs.' },
    { lat: 28.5715, lng: 77.3265, category: 'Poor Lighting', severity: 'high', desc: 'Dark alleyway connecting market blocks.' },
    { lat: 28.5685, lng: 77.3235, category: 'Stalking', severity: 'high', desc: 'Followed near multi-level car parking exit after 8:30 PM.' },
    { lat: 28.5725, lng: 77.3280, category: 'Deserted Area', severity: 'medium', desc: 'Unlit rear perimeter road behind Great India Place mall.' },

    // 4. GREATER NOIDA KNOWLEDGE PARK & PARI CHOWK
    { lat: 28.4700, lng: 77.5050, category: 'Deserted Area', severity: 'high', desc: 'College hostel connecting road pitch dark and isolated.' },
    { lat: 28.4715, lng: 77.5065, category: 'Stalking', severity: 'high', desc: 'Car following slow along wide empty boulevard.' },

    // 5. GHAZIABAD INDIRAPURAM & SHIPRA MALL
    { lat: 28.6400, lng: 77.3750, category: 'Harassment', severity: 'high', desc: 'Catcalling along Kala Pathar road stretch.' },
    { lat: 28.6415, lng: 77.3765, category: 'Poor Lighting', severity: 'high', desc: 'Streetlamps out for 400m near mall entrance.' },

    // 6. LUCKNOW HAZRATGANJ & GOMTI NAGAR
    { lat: 26.8467, lng: 80.9462, category: 'Poor Lighting', severity: 'medium', desc: 'Dimly lit corridor stretch near Hazratganj metro gate 3.' },
    { lat: 26.8520, lng: 80.9980, category: 'Harassment', severity: 'high', desc: 'Loitering near riverfront park entrance making loud remarks.' },
    { lat: 26.8490, lng: 80.9510, category: 'Stalking', severity: 'high', desc: 'Followed along Janpath market rear lane.' },

    // 7. KANPUR SWAROOP NAGAR & Z SQUARE
    { lat: 26.4499, lng: 80.3319, category: 'Harassment', severity: 'medium', desc: 'Group catcalling near coaching institute hub.' },
    { lat: 26.4700, lng: 80.3500, category: 'Poor Lighting', severity: 'high', desc: 'Unlit stretch near Ganga barrage road.' },

    // 8. AGRA TAJ GANJ & MG ROAD
    { lat: 27.1767, lng: 78.0081, category: 'Poor Lighting', severity: 'high', desc: 'Narrow tourist lane near Taj east gate dark after sunset.' },
    { lat: 27.1900, lng: 78.0100, category: 'Harassment', severity: 'high', desc: 'Persistent tout harassment near MG road bus stop.' },

    // 9. VARANASI ASSI GHAT & BHU CAMPUS
    { lat: 25.2820, lng: 82.9984, category: 'Harassment', severity: 'medium', desc: 'Group loitering near Assi ghat stairs shouting inappropriate comments.' },
    { lat: 25.2750, lng: 82.9900, category: 'Poor Lighting', severity: 'high', desc: 'Unlit BHU campus perimeter road past 9 PM.' },

    // 10. MEERUT SHASTRI NAGAR
    { lat: 28.9845, lng: 77.7064, category: 'Poor Lighting', severity: 'high', desc: 'Commercial market rear lane streetlights broken.' },

    // 11. PRAYAGRAJ (ALLAHABAD) CIVIL LINES
    { lat: 25.4358, lng: 81.8463, category: 'Harassment', severity: 'medium', desc: 'Verbal harassment near bus stand intersection.' },

    // 12. ALIGARH AMU CAMPUS
    { lat: 27.8974, lng: 78.0880, category: 'Poor Lighting', severity: 'high', desc: 'University road stretch dark after 8:30 PM.' },

    // 13. BAREILLY CIVIL LINES
    { lat: 28.3670, lng: 79.4304, category: 'Deserted Area', severity: 'medium', desc: 'Secluded walk near railway station connecting road.' },

    // 14. GORAKHPUR GOLGHAR
    { lat: 26.7606, lng: 83.3732, category: 'Harassment', severity: 'high', desc: 'Catcalling near market plaza corner.' },

    // 15. AYODHYA NAYA GHAT
    { lat: 26.7922, lng: 82.1998, category: 'Poor Lighting', severity: 'medium', desc: 'Dim lighting along river walkway extension.' },

    // 16. JHANSI ELITE CROSSING
    { lat: 25.4484, lng: 78.5685, category: 'Deserted Area', severity: 'high', desc: 'Unlit stretch near old fort perimeter.' },

    // 17. MORADABAD KANTH ROAD
    { lat: 28.8386, lng: 78.7733, category: 'Poor Lighting', severity: 'high', desc: 'Streetlamps out along main avenue.' }
  ];

  // PRIORITY 2 — OTHER MAJOR METROS (42 SEED TEMPLATES -> ~520 REPORTS ACROSS 8 METROS)
  const metroSeedTemplates = [
    // DELHI NCR
    { lat: 28.6328, lng: 77.2195, category: 'Poor Lighting', severity: 'medium', desc: 'CP Radial Road 3 metro exit lamp out.' },
    { lat: 28.5528, lng: 77.2038, category: 'Harassment', severity: 'high', desc: 'Hauz Khas Village entrance loitering.' },
    { lat: 28.5520, lng: 77.0580, category: 'Deserted Area', severity: 'high', desc: 'Dwarka Sec 21 metro walk unlit.' },
    { lat: 28.7120, lng: 77.1180, category: 'Poor Lighting', severity: 'high', desc: 'Rohini Sec 10 Japanese park dark perimeter.' },
    { lat: 28.6920, lng: 77.2120, category: 'Harassment', severity: 'high', desc: 'DU North Campus Chhatra Marg loitering.' },

    // MUMBAI
    { lat: 18.9220, lng: 72.8347, category: 'Harassment', severity: 'high', desc: 'Colaba Causeway alleyway catcalling near evening.' },
    { lat: 19.0596, lng: 72.8295, category: 'Poor Lighting', severity: 'medium', desc: 'Bandra Linking Road rear parking dimly lit.' },
    { lat: 19.1197, lng: 72.8464, city: 'Mumbai', category: 'Deserted Area', severity: 'high', desc: 'Andheri East subway unpatrolled after 10 PM.' },
    { lat: 19.0178, lng: 72.8478, category: 'Harassment', severity: 'medium', desc: 'Dadar station west flyover stairs harassment.' },
    { lat: 19.1760, lng: 72.8350, category: 'Poor Lighting', severity: 'high', desc: 'Malad Mindspace back road unlit stretch.' },

    // BANGALORE
    { lat: 12.9352, lng: 77.6245, category: 'Harassment', severity: 'high', desc: 'Koramangala 80ft road corner harassment.' },
    { lat: 12.9784, lng: 77.6408, category: 'Poor Lighting', severity: 'medium', desc: 'Indiranagar 100ft road side lane dark.' },
    { lat: 12.9716, lng: 77.5946, category: 'Stalking', severity: 'high', desc: 'Followed near MG Road metro station exit.' },
    { lat: 12.9698, lng: 77.7500, category: 'Deserted Area', severity: 'high', desc: 'Whitefield ITPL back gate unlit pathway.' },
    { lat: 12.9166, lng: 77.6101, category: 'Poor Lighting', severity: 'medium', desc: 'BTM Layout 2nd stage park road lamps broken.' },

    // KOLKATA
    { lat: 22.5530, lng: 88.3520, category: 'Harassment', severity: 'medium', desc: 'Park Street lane catcalling near pub lane.' },
    { lat: 22.5800, lng: 88.4100, category: 'Poor Lighting', severity: 'high', desc: 'Salt Lake Sector 5 dark stretch.' },
    { lat: 22.5851, lng: 88.3416, category: 'Deserted Area', severity: 'high', desc: 'Howrah station approach subway unlit.' },
    { lat: 22.5280, lng: 88.3650, category: 'Stalking', severity: 'medium', desc: 'Ballygunge circular road shortcut followed.' },

    // CHENNAI
    { lat: 13.0400, lng: 80.2337, category: 'Harassment', severity: 'medium', desc: 'T. Nagar Ranganathan street rear lane.' },
    { lat: 13.0500, lng: 80.2820, category: 'Poor Lighting', severity: 'high', desc: 'Marina beach road service lane dark.' },
    { lat: 13.0067, lng: 80.2570, category: 'Stalking', severity: 'high', desc: 'Adyar depot connecting road followed.' },
    { lat: 12.9780, lng: 80.2180, category: 'Deserted Area', severity: 'medium', desc: 'Velachery MRTS station walkway unlit.' },

    // HYDERABAD
    { lat: 17.4435, lng: 78.3772, category: 'Poor Lighting', severity: 'high', desc: 'HITEC City mindspace service road dark.' },
    { lat: 17.4156, lng: 78.4347, category: 'Harassment', severity: 'high', desc: 'Banjara Hills road 12 loitering.' },
    { lat: 17.3616, lng: 78.4747, category: 'Deserted Area', severity: 'medium', desc: 'Charminar heritage alleyway dark after 9 PM.' },
    { lat: 17.4400, lng: 78.3480, category: 'Stalking', severity: 'high', desc: 'Gachibowli ORR service lane followed.' },

    // PUNE
    { lat: 18.5204, lng: 73.8567, category: 'Harassment', severity: 'medium', desc: 'FC Road crowd loitering near college gate.' },
    { lat: 18.5362, lng: 73.8940, category: 'Poor Lighting', severity: 'high', desc: 'Koregaon Park lane 6 dark stretch.' },
    { lat: 18.5679, lng: 73.9143, category: 'Deserted Area', severity: 'high', desc: 'Viman Nagar IT park lane unlit.' },
    { lat: 18.5912, lng: 73.7389, category: 'Stalking', severity: 'high', desc: 'Hinjewadi phase 1 service road followed.' },

    // AHMEDABAD
    { lat: 23.0225, lng: 72.5714, category: 'Poor Lighting', severity: 'medium', desc: 'CG Road rear alley dim lighting.' },
    { lat: 23.0300, lng: 72.5170, category: 'Deserted Area', severity: 'high', desc: 'SG Highway underpass unlit.' },
    { lat: 23.0120, lng: 72.5410, category: 'Harassment', severity: 'medium', desc: 'Satellite area market road loitering.' }
  ];

  const fullReportsList = [];
  let idCount = 1;

  // Generate UP dataset (~420 reports across 18 UP cities/hubs, heavily weighted on GLA University Mathura)
  for (let cycle = 0; cycle < 11; cycle++) {
    upSeedTemplates.forEach((tmpl, idx) => {
      const daysAgo = cycle % 5;
      const hourOffset = (idx + cycle) % 5;
      fullReportsList.push({
        id: `seed_up_${idCount}`,
        userId: `seed_user_up_${(idCount % 25) + 1}`,
        lat: tmpl.lat + (cycle * 0.0003 * (idx % 2 === 0 ? 1 : -1)),
        lng: tmpl.lng + (cycle * 0.0003 * (idx % 3 === 0 ? 1 : -1)),
        category: tmpl.category,
        severity: tmpl.severity,
        desc: tmpl.desc,
        confirms: (idCount % 3 === 0) ? 3 : (idCount % 2 === 0 ? 1 : 0),
        createdTime: getEveningTimestamp(daysAgo, hourOffset)
      });
      idCount++;
    });
  }

  // Generate Metro Cities dataset (~550 reports across 8 major metros)
  for (let cycle = 0; cycle < 13; cycle++) {
    metroSeedTemplates.forEach((tmpl, idx) => {
      const daysAgo = cycle % 5;
      const hourOffset = (idx + cycle) % 5;
      fullReportsList.push({
        id: `seed_metro_${idCount}`,
        userId: `seed_user_m_${(idCount % 25) + 1}`,
        lat: tmpl.lat + (cycle * 0.00035 * (idx % 2 === 0 ? 1 : -1)),
        lng: tmpl.lng + (cycle * 0.00035 * (idx % 3 === 0 ? 1 : -1)),
        category: tmpl.category,
        severity: tmpl.severity,
        desc: tmpl.desc,
        confirms: (idCount % 4 === 0) ? 2 : 0,
        createdTime: getEveningTimestamp(daysAgo, hourOffset)
      });
      idCount++;
    });
  }

  const insertStmt = db.prepare(`
    INSERT INTO reports (id, user_id, lat, lng, category, severity, description, zone_id, confirm_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  fullReportsList.forEach(r => {
    const zoneId = getCellId(r.lat, r.lng);
    insertStmt.run(r.id, r.userId, r.lat, r.lng, r.category, r.severity, r.desc, zoneId, r.confirms, r.createdTime);
  });

  console.log(`✅ Successfully seeded ${fullReportsList.length} national safety reports across Uttar Pradesh and 8 Major Indian Metros.`);
}
