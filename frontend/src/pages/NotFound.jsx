import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page-content">
      <div className="not-found">
        <div className="not-found-code">404</div>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-home" id="go-home-btn">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
