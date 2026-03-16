/**
 * Ecomail Data Fetcher
 * Saves data grouped by month for period filtering in dashboard.
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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function apiGet(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/${endpoint}`,
      method: 'GET',
      headers: { 'key': API_KEY, 'Content-Type': 'application/json' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 429) reject(new Error(`Rate limited on /${endpoint}`));
          else if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode} on /${endpoint}`));
          else resolve(JSON.parse(data));
        } catch (e) { reject(new Error(`JSON parse error on /${endpoint}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function summarize(campaigns, automations, lists) {
  const totalCampaignRevenue = campaigns.reduce((s, c) => s + (c.conversions_value || 0), 0);
  const totalAutoRevenue = automations.reduce((s, a) => s + (a.conversions_value || 0), 0);
  const avgOR = campaigns.length > 0
    ? (campaigns.reduce((s, c) => s + (c.open_rate || 0), 0) / campaigns.length).toFixed(1)
    : '0';
  const avgCTR = campaigns.length > 0
    ? (campaigns.reduce((s, c) => s + (c.click_rate || 0), 0) / campaigns.length).toFixed(1)
    : '0';
  return {
    total_contacts: lists.reduce((s, l) => s + (l.subscriber_count || 0), 0),
    total_campaign_revenue: totalCampaignRevenue,
    total_automation_revenue: totalAutoRevenue,
    total_revenue: totalCampaignRevenue + totalAutoRevenue,
    avg_campaign_open_rate: avgOR,
    avg_campaign_click_rate: avgCTR,
  };
}

async function main() {
  console.log('🚀 Starting Ecomail data fetch...');
  const now = new Date();
  const timestamp = now.toISOString();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── LISTS ─────────────────────────────────────────────────────────────────
  console.log('📋 Fetching lists...');
  let listsData = [];
  try {
    const listsResponse = await apiGet('lists');
    const lists = listsResponse.data || listsResponse || [];
    for (const list of lists) {
      await sleep(100);
      try {
        const detail = await apiGet(`lists/${list.id}`);
        const count = detail.list?.active_subscribers
                   || detail.list?.subscriber_count
                   || detail.subscribers?.subscribed
                   || detail.subscriber_count
                   || detail.total
                   || list.subscriber_count
                   || 0;
        listsData.push({
          id: list.id,
          name: list.name,
          subscriber_count: count,
          unsubscribed_count: detail.subscribers?.unsubscribed || detail.unsubscribed_count || 0,
        });
        console.log(`  ✓ List: ${list.name}`);
      } catch (e) {
        console.warn(`  ⚠ List ${list.id}: ${e.message}`);
        listsData.push({ id: list.id, name: list.name, subscriber_count: 0 });
      }
    }
  } catch (e) { console.error('❌ Lists:', e.message); }

  // ── CAMPAIGNS ─────────────────────────────────────────────────────────────
  console.log('📧 Fetching campaigns...');
  let allCampaigns = [];
  // Group campaigns by month
  let campaignsByMonth = {};

  try {
    const campaignsResponse = await apiGet('campaigns');
    const campaigns = campaignsResponse.data || campaignsResponse || [];

    for (const campaign of campaigns) {
      await sleep(120);
      try {
        const stats = await apiGet(`campaigns/${campaign.id}/stats`);
        const s = stats.stats || {};
        const monthKey = getMonthKey(campaign.sent_at || campaign.created_at);

        const entry = {
          id: campaign.id,
          name: campaign.name || campaign.subject || `Campaign #${campaign.id}`,
          subject: campaign.subject || '',
          sent_at: campaign.sent_at || campaign.created_at || null,
          status: campaign.status || '',
          delivered: s.delivery || 0,
          open_rate: s.open_rate || 0,
          click_rate: s.click_rate || 0,
          bounce_rate: s.bounce_rate || 0,
          unsub_rate: s.unsub_rate || 0,
          conversions: s.conversions || 0,
          conversions_value: s.conversions_value || 0,
          opens: s.open || 0,
          clicks: s.click || 0,
          bounces: s.bounce || 0,
          unsubscribes: s.unsub || 0,
          inject: s.inject || 0,
          month: monthKey,
        };

        allCampaigns.push(entry);

        if (monthKey) {
          if (!campaignsByMonth[monthKey]) campaignsByMonth[monthKey] = [];
          campaignsByMonth[monthKey].push(entry);
        }

        console.log(`  ✓ Campaign: ${entry.name} [${monthKey}] — ${s.conversions_value || 0} Kč`);
      } catch (e) {
        console.warn(`  ⚠ Campaign ${campaign.id}: ${e.message}`);
      }
    }
  } catch (e) { console.error('❌ Campaigns:', e.message); }

  // ── AUTOMATIONS ───────────────────────────────────────────────────────────
  console.log('⚡ Fetching automations...');
  let allAutomations = [];

  try {
    const automationsResponse = await apiGet('pipelines');
    const automations = automationsResponse.data || automationsResponse || [];

    for (const auto of automations) {
      await sleep(120);
      try {
        const stats = await apiGet(`pipelines/${auto.id}/stats`);
        const s = stats.stats || {};
        const entry = {
          id: auto.id,
          name: auto.name || `Automation #${auto.id}`,
          status: auto.status || '',
          triggered: s.triggered || 0,
          send: s.send || 0,
          open_rate: s.open_rate || 0,
          click_rate: s.click_rate || 0,
          bounce_rate: s.bounce_rate || 0,
          conversions: s.conversions || 0,
          conversions_value: s.conversions_value || 0,
          opens: s.open || 0,
          clicks: s.click || 0,
        };
        allAutomations.push(entry);
        console.log(`  ✓ Automation: ${auto.name} — ${s.conversions_value || 0} Kč`);
      } catch (e) {
        console.warn(`  ⚠ Automation ${auto.id}: ${e.message}`);
      }
    }
  } catch (e) { console.error('❌ Automations:', e.message); }

  // ── BUILD MONTHLY DATA ────────────────────────────────────────────────────
  // Get all unique months from campaigns
  const allMonths = [...new Set(allCampaigns.map(c => c.month).filter(Boolean))].sort().reverse();

  // Build per-month data objects
  const monthlyData = {};
  for (const monthKey of allMonths) {
    const mCampaigns = campaignsByMonth[monthKey] || [];
    // Automations don't have a month (cumulative) — include all in every month view
    monthlyData[monthKey] = {
      campaigns: mCampaigns,
      automations: allAutomations,
      lists: listsData,
      summary: summarize(mCampaigns, allAutomations, listsData),
    };
  }

  // ── SAVE current.json ─────────────────────────────────────────────────────
  const currentMonthCampaigns = campaignsByMonth[currentMonthKey] || [];
  const snapshot = {
    timestamp,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    available_months: allMonths,
    monthly: monthlyData,
    // Top-level = current month (for backwards compat)
    lists: listsData,
    campaigns: currentMonthCampaigns,
    automations: allAutomations,
    summary: summarize(currentMonthCampaigns, allAutomations, listsData),
  };

  const currentPath = path.join(DATA_DIR, 'current.json');
  fs.writeFileSync(currentPath, JSON.stringify(snapshot, null, 2));
  console.log(`✅ Saved → data/current.json`);

  // ── SAVE monthly snapshot for period comparison ───────────────────────────
  const monthSnapshotPath = path.join(DATA_DIR, `snapshot-${currentMonthKey}.json`);
  fs.writeFileSync(monthSnapshotPath, JSON.stringify(snapshot, null, 2));

  const indexPath = path.join(DATA_DIR, 'history-index.json');
  let index = [];
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (e) {}
  }
  if (!index.includes(currentMonthKey)) { index.push(currentMonthKey); index.sort(); }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log('\n📊 Summary (current month):');
  console.log(`  Contacts: ${snapshot.summary.total_contacts.toLocaleString()}`);
  console.log(`  Revenue:  ${snapshot.summary.total_revenue.toLocaleString()} Kč`);
  console.log(`  Months available: ${allMonths.join(', ')}`);
  console.log('\n✨ Done!');
}

main().catch((err) => { console.error('💥 Fatal:', err); process.exit(1); });
