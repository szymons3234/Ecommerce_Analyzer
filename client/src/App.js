import React, { useState } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import ItemsPage from './pages/ItemsPage';
import AnalysisPage from './pages/AnalysisPage';
import AIAgentPage from './pages/AIAgentPage';
import AIModelPage from './pages/AIModelPage';

function App() {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <Router>
      <div className="app">
        <Sidebar isMobileMenuOpen={isMobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />
        <main className="main-content">
          <Header dateRange="Vinted Dashboard" />
          <Switch>
            <Route exact path="/">
              <DashboardPage />
            </Route>
            <Route path="/items">
              <ItemsPage />
            </Route>
            <Route path="/analysis">
              <AnalysisPage />
            </Route>
            <Route path="/ai-agent">
              <AIAgentPage />
            </Route>
            <Route path="/ai-model">
              <AIModelPage />
            </Route>
          </Switch>
          <div className="floating-notification">
            ▶️ Vinted Dashboard
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
