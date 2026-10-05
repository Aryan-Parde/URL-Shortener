import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTotalClicks, getDailyClicks } from '../api';

/* ---------- Custom Recharts Tooltip ---------- */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(17, 17, 39, 0.95)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '0.85rem',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ color: '#9a9abb', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#f0f0ff', fontWeight: 600 }}>
        {payload[0].value} click{payload[0].value !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [shortCode, setShortCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [totalClicks, setTotalClicks] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [activeCode, setActiveCode] = useState('');

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchAnalytics = useCallback(async (code, from, to) => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    setActiveCode(code.trim());

    try {
      const [totalRes, dailyRes] = await Promise.all([
        getTotalClicks(code.trim()),
        getDailyClicks(code.trim(), from || undefined, to || undefined),
      ]);

      setTotalClicks(totalRes.clicks);
      setDailyData(dailyRes);

      // Update URL without re-render
      setSearchParams({ code: code.trim() }, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
      setTotalClicks(null);
      setDailyData([]);
    } finally {
      setLoading(false);
    }
  }, [setSearchParams]);

  // Auto-fetch when arriving with ?code=
  useEffect(() => {
    if (codeFromUrl) {
      setShortCode(codeFromUrl);
      fetchAnalytics(codeFromUrl, '', '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e) {
    e.preventDefault();
    fetchAnalytics(shortCode, fromDate, toDate);
  }

  function handleDateFilter() {
    if (activeCode) {
      fetchAnalytics(activeCode, fromDate, toDate);
    }
  }

  // Format chart dates
  const chartData = dailyData.map(d => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  const hasData = totalClicks !== null;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="analytics-header">
        <h1 className="analytics-title">
          Click <span className="gradient-text">Analytics</span>
        </h1>
        <p className="analytics-subtitle">
          Search by short code to see how your link is performing
        </p>
      </div>

      {/* Search */}
      <form className="analytics-search" onSubmit={handleSearch} id="analytics-search-form">
        <input
          id="analytics-code-input"
          className="analytics-search-input"
          type="text"
          placeholder="Enter a short code, e.g. 1n"
          value={shortCode}
          onChange={e => setShortCode(e.target.value)}
          required
        />
        <button
          id="analytics-search-btn"
          className="analytics-search-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="message error" style={{ marginBottom: '1.5rem' }} id="analytics-error">
          {error}
        </div>
      )}

      {/* Stats */}
      {hasData && (
        <>
          <div className="stats-grid" id="stats-grid">
            <div className="stat-card">
              <div className="stat-icon clicks">📊</div>
              <div className="stat-value">{totalClicks.toLocaleString()}</div>
              <div className="stat-label">Total Clicks</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon code">🔗</div>
              <div className="stat-value" style={{ fontSize: '1.4rem', fontFamily: 'var(--font-mono)' }}>
                {activeCode}
              </div>
              <div className="stat-label">Short Code</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon link">📅</div>
              <div className="stat-value">{dailyData.length}</div>
              <div className="stat-label">Active Days</div>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-section" id="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Clicks Over Time</h3>
              <div className="chart-filters">
                <span className="chart-filter-label">From</span>
                <input
                  id="filter-from"
                  className="chart-date-input"
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
                <span className="chart-filter-label">To</span>
                <input
                  id="filter-to"
                  className="chart-date-input"
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
                <button
                  className="analytics-search-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  type="button"
                  onClick={handleDateFilter}
                  id="apply-filter-btn"
                >
                  Apply
                </button>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="chart-placeholder">
                <div className="chart-placeholder-icon">📈</div>
                <p>No click data yet for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(99,102,241,0.08)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#5c5c7a', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(99,102,241,0.12)' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#5c5c7a', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(99,102,241,0.12)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#clickGradient)"
                    dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: '#a855f7', strokeWidth: 0, r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasData && !error && !loading && (
        <div className="chart-section">
          <div className="chart-placeholder">
            <div className="chart-placeholder-icon">🔍</div>
            <p>Enter a short code above to see its analytics</p>
          </div>
        </div>
      )}
    </div>
  );
}
