import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTotalClicks, getDailyClicks, getLinkInfo } from '../api';

/* ---------- Hook to track theme for chart colors ---------- */
function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

/* ---------- Animated Counter ---------- */
function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (value == null) return;
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{display.toLocaleString()}</>;
}

/* ---------- Custom Recharts Tooltip ---------- */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div
      style={{
        background: isDark ? 'rgba(22, 22, 22, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '0.8rem',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
      }}
    >
      <div style={{ color: isDark ? '#888' : '#999', marginBottom: 4, fontSize: '0.75rem' }}>
        {label}
      </div>
      <div style={{ color: isDark ? '#f0f0f0' : '#111', fontWeight: 600, fontSize: '1rem' }}>
        {payload[0].value} click{payload[0].value !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

/* ---------- Copy Button Inline ---------- */
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      className={`url-copy-btn${copied ? ' copied' : ''}`}
      onClick={handleCopy}
      title={`Copy ${label}`}
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

/* ---------- Component ---------- */
export default function Analytics() {
  const theme = useTheme();
  const isDark = theme === 'dark';

  const [searchParams, setSearchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [shortCode, setShortCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [totalClicks, setTotalClicks] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [activeCode, setActiveCode] = useState('');
  const [linkInfo, setLinkInfo] = useState(null);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeRange, setActiveRange] = useState('all');

  // Chart type toggle
  const [chartType, setChartType] = useState('area');

  const fetchAnalytics = useCallback(async (code, from, to) => {
    if (!code.trim()) return;

    setLoading(true);
    setError('');
    setActiveCode(code.trim());

    try {
      const [totalRes, dailyRes, infoRes] = await Promise.all([
        getTotalClicks(code.trim()),
        getDailyClicks(code.trim(), from || undefined, to || undefined),
        getLinkInfo(code.trim()),
      ]);

      setTotalClicks(totalRes.clicks);
      setDailyData(dailyRes);
      setLinkInfo(infoRes);

      // Update URL without re-render
      setSearchParams({ code: code.trim() }, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to load analytics.');
      setTotalClicks(null);
      setDailyData([]);
      setLinkInfo(null);
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
    setActiveRange('all');
    setFromDate('');
    setToDate('');
    fetchAnalytics(shortCode, '', '');
  }

  function handleDateFilter() {
    if (activeCode) {
      setActiveRange('custom');
      fetchAnalytics(activeCode, fromDate, toDate);
    }
  }

  function handleRangePreset(days) {
    if (!activeCode) return;
    if (days === 'all') {
      setActiveRange('all');
      setFromDate('');
      setToDate('');
      fetchAnalytics(activeCode, '', '');
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    setFromDate(fromStr);
    setToDate(toStr);
    setActiveRange(String(days));
    fetchAnalytics(activeCode, fromStr, toStr);
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

  // Computed stats
  const avgClicks = dailyData.length > 0
    ? (dailyData.reduce((sum, d) => sum + d.clicks, 0) / dailyData.length).toFixed(1)
    : '0';
  const peakDay = dailyData.length > 0
    ? dailyData.reduce((max, d) => d.clicks > max.clicks ? d : max, dailyData[0])
    : null;
  const peakDayLabel = peakDay
    ? new Date(peakDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  // Theme-aware chart colors
  const strokeColor = isDark ? '#888888' : '#333333';
  const gridStroke = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const tickFill = isDark ? '#666' : '#999';
  const axisStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const areaFillId = 'clickGradient';

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

      {/* Active URL Card */}
      {hasData && linkInfo && (
        <div className="active-url-card" id="active-url-card">
          <div className="active-url-header">
            <div className="active-url-badge">
              <span className="active-url-badge-dot" />
              Active Link
            </div>
          </div>

          <div className="active-url-row">
            <div className="active-url-label">Short URL</div>
            <div className="active-url-value-row">
              <a
                href={linkInfo.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="active-url-link short"
                id="active-short-url"
              >
                {linkInfo.short_url}
              </a>
              <CopyButton text={linkInfo.short_url} label="short URL" />
            </div>
          </div>

          <div className="active-url-divider" />

          <div className="active-url-row">
            <div className="active-url-label">Original URL</div>
            <div className="active-url-value-row">
              <a
                href={linkInfo.long_url}
                target="_blank"
                rel="noopener noreferrer"
                className="active-url-link long"
                title={linkInfo.long_url}
                id="active-long-url"
              >
                {linkInfo.long_url}
              </a>
              <CopyButton text={linkInfo.long_url} label="original URL" />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {hasData && (
        <>
          <div className="stats-grid" id="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value">
                <AnimatedCounter value={totalClicks} />
              </div>
              <div className="stat-label">Total Clicks</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📅</div>
              <div className="stat-value">
                <AnimatedCounter value={dailyData.length} />
              </div>
              <div className="stat-label">Active Days</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-value">{avgClicks}</div>
              <div className="stat-label">Avg Clicks / Day</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>
                {peakDay ? peakDay.clicks : '—'}
              </div>
              <div className="stat-label">
                Peak Day{peakDay ? ` · ${peakDayLabel}` : ''}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="chart-section" id="chart-section">
            <div className="chart-header">
              <h3 className="chart-title">Clicks Over Time</h3>

              <div className="chart-controls">
                {/* Range presets */}
                <div className="range-presets">
                  {[
                    { label: '7d', value: 7 },
                    { label: '30d', value: 30 },
                    { label: '90d', value: 90 },
                    { label: 'All', value: 'all' },
                  ].map(preset => (
                    <button
                      key={preset.value}
                      className={`range-preset-btn${activeRange === String(preset.value) ? ' active' : ''}`}
                      onClick={() => handleRangePreset(preset.value)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Chart type toggle */}
                <div className="chart-type-toggle">
                  <button
                    className={`chart-type-btn${chartType === 'area' ? ' active' : ''}`}
                    onClick={() => setChartType('area')}
                    type="button"
                    title="Area chart"
                  >
                    ▤
                  </button>
                  <button
                    className={`chart-type-btn${chartType === 'bar' ? ' active' : ''}`}
                    onClick={() => setChartType('bar')}
                    type="button"
                    title="Bar chart"
                  >
                    ▥
                  </button>
                </div>
              </div>
            </div>

            {/* Custom date filter */}
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
                style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                type="button"
                onClick={handleDateFilter}
                id="apply-filter-btn"
              >
                Apply
              </button>
            </div>

            {chartData.length === 0 ? (
              <div className="chart-placeholder">
                <div className="chart-placeholder-icon">📈</div>
                <p>No click data yet for this period</p>
              </div>
            ) : chartType === 'area' ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={areaFillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    stroke={strokeColor}
                    strokeWidth={1.5}
                    fill={`url(#${areaFillId})`}
                    dot={{ fill: strokeColor, strokeWidth: 0, r: 2.5 }}
                    activeDot={{ fill: isDark ? '#ccc' : '#555', strokeWidth: 0, r: 5 }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: tickFill, fontSize: 11 }}
                    axisLine={{ stroke: axisStroke }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="clicks"
                    fill={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}
                    stroke={strokeColor}
                    strokeWidth={1}
                    radius={[4, 4, 0, 0]}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </BarChart>
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
