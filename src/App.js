import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import Home from './components/pages/Home';
import MedicalAid from './components/pages/MedicalAid';
import TransportAid from './components/pages/TransportAid';
import Volunteer from './components/pages/Volunteer';
import LiveReports from './components/pages/LiveReports';
import Weather from './components/pages/Weather';
import AidMap from './components/pages/AidMap';
import TestPage from './components/pages/TestPage';
import NotificationHistory from './components/pages/NotificationHistory';
import VolunteerDashboard from './components/VolunteerDashboard';
import './assets/css/App.css';

function App() {
  return (
    <div className="App">
      <Header />
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/medical-aid" element={<MedicalAid />} />
          <Route path="/transport-aid" element={<TransportAid />} />
          <Route path="/volunteer" element={<Volunteer />} />
          <Route path="/live-reports" element={<LiveReports />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/aid-map/:type/:id" element={<AidMap />} />
          <Route path="/notifications" element={<NotificationHistory />} />
          <Route path="/volunteer-dashboard" element={<VolunteerDashboard />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 