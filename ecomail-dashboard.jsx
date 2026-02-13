import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, Mail, MousePointer, Users, TrendingUp, AlertCircle, Send, Eye } from 'lucide-react';

// Konfigurace API
const ECOMAIL_API_KEY = 'VÁŠ_API_KLÍČ_ZDE'; // Nahraďte svým API klíčem z Ecomailu
const ECOMAIL_API_BASE = 'https://api2.ecomailapp.cz';

const EcomailDashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch dat z Ecomail API
  const fetchEcomailData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch kampaní
      const campaignsResponse = await fetch(`${ECOMAIL_API_BASE}/campaigns`, {
        headers: {
          'key': ECOMAIL_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!campaignsResponse.ok) {
        throw new Error(`API Error: ${campaignsResponse.status}`);
      }

      const campaignsData = await campaignsResponse.json();
      
      // Zpracování dat kampaní
      const processedCampaigns = campaignsData.slice(0, 10).map(campaign => ({
        id: campaign.id,
        name: campaign.name || 'Bez názvu',
        sent: campaign.sent || 0,
        opened: campaign.opened || 0,
        clicked: campaign.clicked || 0,
        bounced: campaign.bounced || 0,
        unsubscribed: campaign.unsubscribed || 0,
        openRate: campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(2) : 0,
        clickRate: campaign.sent > 0 ? ((campaign.clicked / campaign.sent) * 100).toFixed(2) : 0,
        ctr: campaign.opened > 0 ? ((campaign.clicked / campaign.opened) * 100).toFixed(2) : 0,
        date: campaign.created_at || new Date().toISOString()
      }));

      setCampaigns(processedCampaigns);

      // Agregované statistiky
      const totalSent = processedCampaigns.reduce((sum, c) => sum + c.sent, 0);
      const totalOpened = processedCampaigns.reduce((sum, c) => sum + c.opened, 0);
      const totalClicked = processedCampaigns.reduce((sum, c) => sum + c.clicked, 0);
      const totalBounced = processedCampaigns.reduce((sum, c) => sum + c.bounced, 0);

      setStats({
        totalSent,
        totalOpened,
        totalClicked,
        totalBounced,
        avgOpenRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(2) : 0,
        avgClickRate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(2) : 0,
        avgCTR: totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(2) : 0
      });

      setLastUpdate(new Date());
    } catch (err) {
      console.error('Chyba při načítání dat:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh každých 30 sekund
  useEffect(() => {
    fetchEcomailData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchEcomailData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Formátování času
  const formatTime = (date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const COLORS = ['#FF6B9D', '#C44569', '#FFA07A', '#FFD93D', '#6BCF7F'];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      padding: '2rem',
      color: '#fff'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '3rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '800',
            margin: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            Ecomail Dashboard
          </h1>
          <p style={{
            margin: '0.5rem 0 0 0',
            color: '#a0aec0',
            fontSize: '1rem'
          }}>
            Real-time emailingové metriky
            {lastUpdate && ` • Poslední aktualizace: ${formatTime(lastUpdate)}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            color: '#a0aec0'
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            Auto-refresh (30s)
          </label>
          
          <button
            onClick={fetchEcomailData}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
          >
            <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Obnovit data
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={24} color="#ef4444" />
          <div>
            <strong style={{ color: '#ef4444' }}>Chyba při načítání dat</strong>
            <p style={{ margin: '0.25rem 0 0 0', color: '#fca5a5' }}>{error}</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#fca5a5' }}>
              Zkontrolujte, zda máte správně nastavený API klíč v konstantě ECOMAIL_API_KEY.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <KPICard
            icon={<Send size={24} />}
            title="Celkem odesláno"
            value={stats.totalSent.toLocaleString('cs-CZ')}
            color="#667eea"
          />
          <KPICard
            icon={<Eye size={24} />}
            title="Otevření"
            value={stats.totalOpened.toLocaleString('cs-CZ')}
            subtitle={`${stats.avgOpenRate}% průměrný OR`}
            color="#48bb78"
          />
          <KPICard
            icon={<MousePointer size={24} />}
            title="Kliky"
            value={stats.totalClicked.toLocaleString('cs-CZ')}
            subtitle={`${stats.avgClickRate}% průměrný CTR`}
            color="#ed8936"
          />
          <KPICard
            icon={<TrendingUp size={24} />}
            title="CTOR"
            value={`${stats.avgCTR}%`}
            subtitle="Click-to-Open Rate"
            color="#9f7aea"
          />
        </div>
      )}

      {/* Charts */}
      {campaigns.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          {/* Open Rate Chart */}
          <ChartCard title="Open Rate po kampaních">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={campaigns.slice(0, 7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis 
                  dataKey="name" 
                  stroke="#a0aec0"
                  tick={{ fill: '#a0aec0', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="#a0aec0" tick={{ fill: '#a0aec0' }} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1a202c', 
                    border: '1px solid #4a5568',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="openRate" fill="#667eea" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Click Rate Chart */}
          <ChartCard title="Click Rate po kampaních">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={campaigns.slice(0, 7)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis 
                  dataKey="name" 
                  stroke="#a0aec0"
                  tick={{ fill: '#a0aec0', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="#a0aec0" tick={{ fill: '#a0aec0' }} />
                <Tooltip 
                  contentStyle={{ 
                    background: '#1a202c', 
                    border: '1px solid #4a5568',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="clickRate" fill="#48bb78" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Campaign Performance Trend */}
      {campaigns.length > 0 && (
        <ChartCard title="Trend výkonnosti kampaní" fullWidth>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={campaigns.slice(0, 10).reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis 
                dataKey="name" 
                stroke="#a0aec0"
                tick={{ fill: '#a0aec0', fontSize: 12 }}
              />
              <YAxis stroke="#a0aec0" tick={{ fill: '#a0aec0' }} />
              <Tooltip 
                contentStyle={{ 
                  background: '#1a202c', 
                  border: '1px solid #4a5568',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="openRate" 
                stroke="#667eea" 
                strokeWidth={3}
                name="Open Rate %"
                dot={{ fill: '#667eea', r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="clickRate" 
                stroke="#48bb78" 
                strokeWidth={3}
                name="Click Rate %"
                dot={{ fill: '#48bb78', r: 5 }}
              />
              <Line 
                type="monotone" 
                dataKey="ctr" 
                stroke="#ed8936" 
                strokeWidth={3}
                name="CTOR %"
                dot={{ fill: '#ed8936', r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Campaign Table */}
      {campaigns.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginTop: '2rem'
        }}>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            marginBottom: '1.5rem',
            color: '#fff'
          }}>
            Detail kampaní
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
                  <th style={tableHeaderStyle}>Kampaň</th>
                  <th style={tableHeaderStyle}>Odesláno</th>
                  <th style={tableHeaderStyle}>Otevřeno</th>
                  <th style={tableHeaderStyle}>Kliknuto</th>
                  <th style={tableHeaderStyle}>Open Rate</th>
                  <th style={tableHeaderStyle}>Click Rate</th>
                  <th style={tableHeaderStyle}>CTOR</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign, index) => (
                  <tr 
                    key={campaign.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={tableCellStyle}>{campaign.name}</td>
                    <td style={tableCellStyle}>{campaign.sent.toLocaleString('cs-CZ')}</td>
                    <td style={tableCellStyle}>{campaign.opened.toLocaleString('cs-CZ')}</td>
                    <td style={tableCellStyle}>{campaign.clicked.toLocaleString('cs-CZ')}</td>
                    <td style={tableCellStyle}>
                      <span style={{
                        background: getColorForRate(campaign.openRate),
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        {campaign.openRate}%
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        background: getColorForRate(campaign.clickRate),
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        {campaign.clickRate}%
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        background: getColorForRate(campaign.ctr),
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontWeight: '600'
                      }}>
                        {campaign.ctr}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && campaigns.length === 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <RefreshCw size={48} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: '1.25rem', color: '#a0aec0' }}>Načítám data z Ecomailu...</p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Helper komponenty
const KPICard = ({ icon, title, value, subtitle, color }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-4px)';
    e.currentTarget.style.boxShadow = `0 8px 30px ${color}40`;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
      <div style={{
        background: `${color}20`,
        padding: '0.75rem',
        borderRadius: '12px',
        color: color
      }}>
        {icon}
      </div>
      <span style={{ color: '#a0aec0', fontSize: '0.875rem', fontWeight: '500' }}>{title}</span>
    </div>
    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fff', marginBottom: '0.25rem' }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ fontSize: '0.875rem', color: '#a0aec0' }}>{subtitle}</div>
    )}
  </div>
);

const ChartCard = ({ title, children, fullWidth }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    padding: '2rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    gridColumn: fullWidth ? '1 / -1' : 'auto'
  }}>
    <h3 style={{
      fontSize: '1.25rem',
      fontWeight: '700',
      marginBottom: '1.5rem',
      color: '#fff'
    }}>
      {title}
    </h3>
    {children}
  </div>
);

const tableHeaderStyle = {
  padding: '1rem',
  textAlign: 'left',
  color: '#a0aec0',
  fontWeight: '600',
  fontSize: '0.875rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tableCellStyle = {
  padding: '1rem',
  color: '#fff'
};

const getColorForRate = (rate) => {
  const numRate = parseFloat(rate);
  if (numRate >= 30) return 'rgba(72, 187, 120, 0.2)';
  if (numRate >= 20) return 'rgba(237, 137, 54, 0.2)';
  return 'rgba(239, 68, 68, 0.2)';
};

export default EcomailDashboard;
