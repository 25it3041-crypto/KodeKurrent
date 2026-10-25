import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import CandidatePortal from './components/candidate/CandidatePortal';
import HRDashboard from './components/hr/HRDashboard';
import MobileCamera from './pages/MobileCamera';
import useStore from './lib/store';

function App() {
  const activePortal = useStore(s => s.activePortal);

  return (
    <BrowserRouter>
      <Routes>
        {/* Mobile camera page - no header */}
        <Route path="/mobile-cam" element={<MobileCamera />} />

        {/* Main platform */}
        <Route path="/*" element={
          <div className="min-h-screen gradient-canvas flex flex-col">
            <Header />
            <main className="flex-1 overflow-hidden">
              {activePortal === 'candidate' ? <CandidatePortal /> : <HRDashboard />}
            </main>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
