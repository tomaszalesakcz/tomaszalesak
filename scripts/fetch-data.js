/**
 * Ecomail Data Fetcher
 * Runs via GitHub Actions every 24h.
 * Saves current snapshot + maintains monthly history for period comparison.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.ECOMAIL_API_KEY;
const BASE_URL = 'api2.ecomailapp.cz';
const DATA_DIR = path.join(__dirname, '..', 'data');

if (!API_KEY) {
  console.error('❌ ECOMAIL_API_KEY environment variable is not set.');
  process.exit(1);
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Makes a GET request to the Ecomail API.
 */
function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/${endpoint}`,
      method: 'GET',
      headers: {
        'key': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 429) {
            reject(new Error(`Rate limited on /${endpoint}. Retry after ${res.headers['retry-after']}s`));
          } else if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} on /${endpoint}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(new Error(`JSON parse error on /${endpoint}: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Sleep helper for rate limiting (max 1000 req/min).
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Ecomail data fetch...');
  const now = new Date();
  const timestamp = now.toISOString();

  // ── 1. LISTS ──────────────────────────────────────────────────────────────
  console.log('📋 Fetching lists...');
  let listsData = [];
  try {
    const listsResponse = await apiGet('lists');
    const lists = listsResponse.data || listsResponse || [];
    
    for (const list of lists) {
      await sleep(100);
      try {
        const detail = await apiGet(`lists/${list.id}`);
        listsData.push({
          id: list.id,
          name: list.name,
          subscriber_count: detail.subscriber_count || detail.total || list.subscriber_count || 0,
          unsubscribed_count: detail.unsubscribed_count || 0,
        });
        console.log(`  ✓ List: ${list.name} (${listsData[listsData.length-1].subscriber_count} contacts)`);
      } catch (e) {
        console.warn(`  ⚠ Could not fetch list detail for ${list.id}: ${e.message}`);
        listsData.push({ id: list.id, name: list.name, subscriber_count: 0 });
      }
    }
  } catch (e) {
    console.error('❌ Failed to fetch lists:', e.message);
  }

  // ── 2. CAMPAIGNS ─────────────────────────────────────────────────────────
  console.log('📧 Fetching campaigns...');
  let campaignsData = [];
  try {
    const campaignsResponse = await apiGet('campaigns');
    const campaigns = campaignsResponse.data || campaignsResponse || [];
    
    for (const campaign of campaigns) {
      await sleep(120);
      try {
        const stats = await apiGet(`campaigns/${campaign.id}/stats`);
        const s = stats.stats || {};
        campaignsData.push({
          id: campaign.id,
          name: campaign.name || campaign.subject || `Campaign #${campaign.id}`,
          subject: campaign.subject || '',
          sent_at: campaign.sent_at || campaign.created_at || null,
          status: campaign.status || '',
          // Key metrics
          delivered: s.delivery || 0,
          open_rate: s.open_rate || 0,
          click_rate: s.click_rate || 0,
          bounce_rate: s.bounce_rate || 0,
          unsub_rate: s.unsub_rate || 0,
          conversions: s.conversions || 0,
          conversions_value: s.conversions_value || 0,
          // Raw counts
          opens: s.open || 0,
          clicks: s.click || 0,
          bounces: s.bounce || 0,
          unsubscribes: s.unsub || 0,
          inject: s.inject || 0,
        });
        console.log(`  ✓ Campaign: ${campaign.name || campaign.subject} — ${s.conversions_value || 0} CZK`);
      } catch (e) {
        console.warn(`  ⚠ Could not fetch stats for campaign ${campaign.id}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('❌ Failed to fetch campaigns:', e.message);
  }

  // ── 3. AUTOMATIONS ───────────────────────────────────────────────────────
  console.log('⚡ Fetching automations...');
  let automationsData = [];
  try {
    const automationsResponse = await apiGet('pipelines');
    const automations = automationsResponse.data || automationsResponse || [];
    
    for (const auto of automations) {
      await sleep(120);
      try {
        const stats = await apiGet(`pipelines/${auto.id}/stats`);
        const s = stats.stats || {};
        automationsData.push({
          id: auto.id,
          name: auto.name || `Automation #${auto.id}`,
          status: auto.status || '',
          // Key metrics
          triggered: s.triggered || 0,
          send: s.send || 0,
          open_rate: s.open_rate || 0,
          click_rate: s.click_rate || 0,
          bounce_rate: s.bounce_rate || 0,
          conversions: s.conversions || 0,
          conversions_value: s.conversions_value || 0,
          // Raw counts
          opens: s.open || 0,
          clicks: s.click || 0,
        });
        console.log(`  ✓ Automation: ${auto.name} — ${s.conversions_value || 0} CZK`);
      } catch (e) {
        console.warn(`  ⚠ Could not fetch stats for automation ${auto.id}: ${e.message}`);
      }
    }
  } catch (e) {
    console.error('❌ Failed to fetch automations:', e.message);
  }

  // ── 4. BUILD SNAPSHOT ────────────────────────────────────────────────────
  const snapshot = {
    timestamp,
    year: now.getFullYear(),
    month: now.getMonth() + 1, // 1-12
    day: now.getDate(),
    lists: listsData,
    campaigns: campaignsData,
    automations: automationsData,
    summary: {
      total_contacts: listsData.reduce((sum, l) => sum + l.subscriber_count, 0),
      total_campaign_revenue: campaignsData.reduce((sum, c) => sum + c.conversions_value, 0),
      total_automation_revenue: automationsData.reduce((sum, a) => sum + a.conversions_value, 0),
      total_revenue: 0, // filled below
      avg_campaign_open_rate: campaignsData.length > 0
        ? (campaignsData.reduce((sum, c) => sum + c.open_rate, 0) / campaignsData.length).toFixed(1)
        : 0,
      avg_campaign_click_rate: campaignsData.length > 0
        ? (campaignsData.reduce((sum, c) => sum + c.click_rate, 0) / campaignsData.length).toFixed(1)
        : 0,
    }
  };
  snapshot.summary.total_revenue = snapshot.summary.total_campaign_revenue + snapshot.summary.total_automation_revenue;

  // ── 5. SAVE CURRENT SNAPSHOT ─────────────────────────────────────────────
  const currentPath = path.join(DATA_DIR, 'current.json');
  fs.writeFileSync(currentPath, JSON.stringify(snapshot, null, 2));
  console.log(`✅ Saved current snapshot → data/current.json`);

  // ── 6. SAVE MONTHLY SNAPSHOT ─────────────────────────────────────────────
  // One file per year-month, overwritten daily. Used for period comparison.
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthPath = path.join(DATA_DIR, `snapshot-${monthKey}.json`);
  fs.writeFileSync(monthPath, JSON.stringify(snapshot, null, 2));
  console.log(`✅ Saved monthly snapshot → data/snapshot-${monthKey}.json`);

  // ── 7. SAVE/UPDATE HISTORY INDEX ─────────────────────────────────────────
  // A lightweight index file listing available monthly snapshots
  const indexPath = path.join(DATA_DIR, 'history-index.json');
  let index = [];
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) {}
  }
  if (!index.includes(monthKey)) {
    index.push(monthKey);
    index.sort();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log(`✅ Updated history index`);
  }

  console.log('\n📊 Summary:');
  console.log(`  Contacts:   ${snapshot.summary.total_contacts.toLocaleString()}`);
  console.log(`  Revenue:    ${snapshot.summary.total_revenue.toLocaleString()} CZK`);
  console.log(`  Avg OR:     ${snapshot.summary.avg_campaign_open_rate}%`);
  console.log(`  Campaigns:  ${campaignsData.length}`);
  console.log(`  Automations: ${automationsData.length}`);
  console.log('\n✨ Done!');
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
