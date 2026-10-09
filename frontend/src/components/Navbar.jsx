import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';

function getInitialTheme() {
  const stored = localStorage.getItem('snip_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Navbar() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('snip_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <nav className="navbar" id="main-nav">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <span className="navbar-brand-icon">S</span>
          Snip
        </NavLink>

        <div className="navbar-right">
          <div className="navbar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              id="nav-home"
            >
              Shorten
            </NavLink>
            <NavLink
              to="/analytics"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              id="nav-analytics"
            >
              Analytics
            </NavLink>
          </div>

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            id="theme-toggle-btn"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '☽' : '☀'}
          </button>
        </div>
      </div>
    </nav>
  );
}
