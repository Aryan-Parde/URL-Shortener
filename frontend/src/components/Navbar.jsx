import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar" id="main-nav">
      <div className="navbar-inner">
        <NavLink to="/" className="navbar-brand">
          <span className="navbar-brand-icon">S</span>
          Snip
        </NavLink>

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
      </div>
    </nav>
  );
}
