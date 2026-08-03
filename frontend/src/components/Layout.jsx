import { Link, NavLink } from "react-router-dom";

export function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/feed" className="logo">
            BlockShield Blog
          </Link>
          <nav className="nav">
            <NavLink to="/feed" className={({ isActive }) => (isActive ? "active" : "")}>
              피드
            </NavLink>
            <NavLink to="/editor" className={({ isActive }) => (isActive ? "active" : "")}>
              글쓰기
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
