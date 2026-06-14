import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import TopicInputPage from './pages/TopicInputPage'
import BookUploadPage from './pages/BookUploadPage'
import DashboardPage from './pages/DashboardPage'
import RoadmapPage from './pages/RoadmapPage'
import SimulationPage from './pages/SimulationPage'
import QuizPage from './pages/QuizPage'
import MindMapPage from './pages/MindMapPage'
import ProtectedRoute from './components/ProtectedRoute'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/topic" element={<TopicInputPage />} />
          <Route path="/upload" element={<BookUploadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/simulation/:nodeId" element={<SimulationPage />} />
          <Route path="/quiz/:nodeId" element={<QuizPage />} />
          <Route path="/mindmap" element={<MindMapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
