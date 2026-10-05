import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortenUrl } from '../api';

/* ---------- localStorage helpers ---------- */
const STORAGE_KEY = 'snip_recent_links';

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

/* ---------- Component ---------- */
export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentLinks, setRecentLinks] = useState(loadRecent);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const data = await shortenUrl(trimmed);
      setResult(data);

      // Add to recent links
      const newLink = {
        short_code: data.short_code,
        short_url: data.short_url,
        long_url: trimmed,
        created_at: new Date().toISOString(),
      };
      const updated = [newLink, ...recentLinks.filter(l => l.short_code !== data.short_code)].slice(0, 10);
      setRecentLinks(updated);
      saveRecent(updated);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.short_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = result.short_url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function clearRecent() {
    setRecentLinks([]);
    saveRecent([]);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="page-content">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Fast &amp; Reliable
        </div>

        <h1>
          Make Every Link{' '}
          <span className="gradient-text">Count</span>
        </h1>

        <p className="hero-subtitle">
          Shorten long URLs in one click and track every visit with
          real-time analytics. No sign-up required.
        </p>

        {/* Shorten Form */}
        <div className="shorten-form-wrapper">
          <form className="shorten-form" onSubmit={handleSubmit} id="shorten-form">
            <input
              id="url-input"
              className="shorten-input"
              type="url"
              placeholder="Paste a long URL here…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              autoFocus
            />
            <button
              id="shorten-btn"
              className="shorten-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Shorten'}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="message error" style={{ marginTop: '1rem' }} id="error-msg">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="result-card" id="result-card">
              <div className="result-label">Your shortened URL</div>
              <div className="result-url-row">
                <div className="result-url" id="result-url">{result.short_url}</div>
                <button
                  className={`copy-btn${copied ? ' copied' : ''}`}
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  id="copy-btn"
                >
                  {copied ? '✓' : '⧉'}
                </button>
              </div>
              <div className="result-actions">
                <Link
                  to={`/analytics?code=${result.short_code}`}
                  className="result-action-link"
                  id="view-analytics-link"
                >
                  📊 View Analytics
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recent Links */}
      <section className="recent-section" id="recent-links-section">
        <div className="section-header">
          <h2 className="section-title">Recent Links</h2>
          {recentLinks.length > 0 && (
            <button className="section-action" onClick={clearRecent} id="clear-recent-btn">
              Clear All
            </button>
          )}
        </div>

        {recentLinks.length === 0 ? (
          <div className="recent-empty">
            <div className="recent-empty-icon">🔗</div>
            <p>No links shortened yet. Try one above!</p>
          </div>
        ) : (
          <table className="recent-table" id="recent-table">
            <thead>
              <tr>
                <th>Short Code</th>
                <th>Original URL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentLinks.map(link => (
                <tr key={link.short_code}>
                  <td>
                    <span className="recent-short-code">{link.short_code}</span>
                  </td>
                  <td>
                    <span className="recent-long-url" title={link.long_url}>
                      {link.long_url}
                    </span>
                  </td>
                  <td>
                    <span className="recent-date">{formatDate(link.created_at)}</span>
                  </td>
                  <td>
                    <Link
                      to={`/analytics?code=${link.short_code}`}
                      className="result-action-link"
                    >
                      📊 Analytics
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
