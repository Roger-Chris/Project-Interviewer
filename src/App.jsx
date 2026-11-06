import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import UploadPage from './pages/Upload/UploadPage';
import AnalysisPage from './pages/Analysis/AnalysisPage';
import VivaPage from './pages/Viva/VivaPage';
import ReportPage from './pages/Report/ReportPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';

// Inner component to handle routing syncing
const AppContent = () => {
  const { 
    projectDetails, 
    isAnalysisRunning, 
    isAnalysisComplete, 
    vivaQuestions 
  } = useProject();
  const navigate = useNavigate();
  const location = useLocation();

  // Route guards based on real state data to prevent direct URL access to uninitialized pages
  useEffect(() => {
    const hasProject = projectDetails && projectDetails.title !== '';
    const hasQuestions = vivaQuestions && vivaQuestions.length > 0;

    switch (location.pathname) {
      case '/analysis':
        if (!hasProject && !isAnalysisRunning && !isAnalysisComplete) {
          navigate('/');
        }
        break;
      case '/viva':
        if (!hasQuestions) {
          navigate('/');
        }
        break;
      case '/report':
        if (!isAnalysisComplete) {
          navigate('/');
        }
        break;
      default:
        break;
    }
  }, [location.pathname, projectDetails, isAnalysisRunning, isAnalysisComplete, vivaQuestions, navigate]);

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/viva" element={<VivaPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MainLayout>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ProjectProvider>
          <AppContent />
        </ProjectProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
