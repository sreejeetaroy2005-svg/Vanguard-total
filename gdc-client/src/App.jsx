import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import MainPage from './MainPage';       
import Register from './Register';       // Hotel Admin
import RegisterUser from './RegisterUser'; // Guest Signup/Login
import Dashboard from './Dashboard';     
import UserSOS from './UserSOS';         // The Emergency SOS Component
import HotelLogin from './HotelLogin';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* 1. MAIN PAGE IS THE LANDING */}
          <Route path="/" element={<MainPage />} />
          
          {/* 2. HOTEL ADMIN PATH */}
          <Route path="/register" element={<Register />} />

          {/* 2.5. HOTEL LOGIN */}
          <Route path="/login" element={<HotelLogin />} />

          {/* 3. GUEST SIGNUP/LOGIN */}
          <Route path="/signup" element={<RegisterUser />} />

          {/* 4. THE TACTICAL DASHBOARD (Map & Exit Paths) */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* 5. EMERGENCY SOS PAGE */}
          {/* You can navigate here from the Dashboard or directly via /sos */}
          <Route path="/sos" element={<UserSOS />} />

          {/* Fallback: Redirect to Main Page */}
          <Route path="*" element={<MainPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;