import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({ isMobileMenuOpen, toggleMobileMenu }) => {
  return (
    <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        <div className="logo">🛍️</div>
        <div>
          <div className="sidebar-title">Vinted</div>
          <div className="sidebar-subtitle">Dashboard</div>
        </div>
        <button className="hamburger-menu" onClick={toggleMobileMenu}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <div className="sidebar-content">
        <nav className="sidebar-nav">
          <NavLink to="/" className="nav-item" activeClassName="active" exact onClick={toggleMobileMenu}>Panel główny</NavLink>
          <NavLink to="/items" className="nav-item" activeClassName="active" onClick={toggleMobileMenu}>Przedmioty</NavLink>
          <NavLink to="/analysis" className="nav-item" activeClassName="active" onClick={toggleMobileMenu}>Analiza</NavLink>
          <NavLink to="/ai-agent" className="nav-item" activeClassName="active" onClick={toggleMobileMenu}>Agent AI</NavLink>
          <NavLink to="/ai-model" className="nav-item" activeClassName="active" onClick={toggleMobileMenu}>Model AI</NavLink>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
