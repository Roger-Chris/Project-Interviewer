import React, { useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import Card from '../../components/common/Card';
import VivaQuestionCard from '../../components/viva/VivaQuestionCard';
import LiveAnalyticsSidebar from '../../components/viva/LiveAnalyticsSidebar';
import { ResponsiveContainer, RadialBarChart, RadialBar, Cell } from 'recharts';
import { ShieldCheck, Award, Loader2 } from 'lucide-react';
import CheatDetection from '../../components/viva/CheatDetection';

const VivaPage = () => {
  const {
    projectDetails,
    selectedProjectTemplate,
    vivaQuestions,
    currentQuestionIdx,
    vivaAnswers,
    countdownTimer,
    vivaCompletedCount,
    saveAnswerDraft,
    evaluateAndProceed,
    logSuspicion,
    generateReport,
    isGeneratingReport,
    consentRecord,
    logConsentRecord
  } = useProject();

  const [agreed, setAgreed] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [screenPermission, setScreenPermission] = useState('prompt');
  const [cameraStream, setCameraStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isStartingViva, setIsStartingViva] = useState(false);

  const currentQuestion = vivaQuestions[currentQuestionIdx];
  const isVivaFinished = vivaCompletedCount >= vivaQuestions.length;
  const currentSkill = currentQuestion?.skill_name;
  const allSkills = selectedProjectTemplate?.suggested_skills || [];

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
      setCameraStream(stream);
    } catch (err) {
      setCameraPermission('denied');
    }
  };

  const requestScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenPermission('granted');
      setScreenStream(stream);
    } catch (err) {
      setScreenPermission('denied');
    }
  };

  const handleStartViva = async () => {
    setIsStartingViva(true);
    await logConsentRecord({
      userId: projectDetails.userId || 'default_student',
      timestamp: new Date().toISOString(),
      permissionsGranted: {
        camera: cameraPermission === 'granted',
        screenShare: screenPermission === 'granted'
      },
      consentCheckboxChecked: agreed
    });
    setIsStartingViva(false);
  };

  // Cleanup streams only on component unmount
  React.useEffect(() => {
    const cam = cameraStream;
    const scr = screenStream;
    return () => {
      if (cam) cam.getTracks().forEach(t => t.stop());
      if (scr) scr.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mini gauge for header skill confidence circular display
  const renderMiniConfidenceGauge = (value) => {
    const data = [
      { name: 'Value', value: value, fill: '#818cf8' },
      { name: 'Back', value: 100 - value, fill: '#1e293b' }
    ];

    return (
      <div className="flex items-center gap-3 bg-dark-900 border border-dark-600/35 rounded-xl px-4 py-2 flex-shrink-0">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="95%"
              barSize={4}
              data={data}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar minAngle={15} background clockWise={false} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </RadialBar>
            </RadialBarChart>
          </ResponsiveContainer>
          <span className="absolute text-xs font-black text-white font-mono">{value}%</span>
        </div>
        <div className="flex flex-col text-left select-none">
          <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest leading-none mb-0.5">Skill Confidence</span>
          <span className="text-xs font-bold text-brand-300">High Probability</span>
        </div>
      </div>
    );
  };

  if (!consentRecord) {
    return (
      <div className="w-full flex items-center justify-center py-12 px-4 select-none max-w-2xl mx-auto">
        <Card className="flex flex-col gap-6 p-8 border-brand-500/30 shadow-2xl relative text-left w-full" glow>
          <div className="border-b border-dark-600/20 pb-4">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-400" />
              Integrity Verification & Consent
            </h2>
            <p className="text-xs text-dark-300 mt-1 leading-relaxed">
              This session is monitored. Your camera, screen activity, and browser focus will be recorded and reviewed for exam integrity.
            </p>
          </div>

          <div className="bg-dark-950 p-4 rounded-xl border border-dark-600/20 flex flex-col gap-2.5 text-xs text-dark-200">
            <span className="font-bold text-white mb-1 uppercase tracking-wider text-[10px] text-brand-300">Captured Telemetry:</span>
            <div className="flex items-center gap-2">
              <span className="text-brand-400">✓</span>
              <span><strong>Camera Feed:</strong> Continuous monitoring for candidate face presence.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-400">✓</span>
              <span><strong>Screen Share:</strong> Active desktop capture to verify workspace context.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-400">✓</span>
              <span><strong>Tab & Focus Shifts:</strong> Detection of focus loss, minimized browsers, or app switches.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-400">✓</span>
              <span><strong>Object Detection:</strong> In-browser detection of secondary devices like phones.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-400">✓</span>
              <span><strong>Face Presence & Gaze Estimation:</strong> Real-time estimation of head yaw angle.</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-dark-900 border border-dark-600/10 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white">Camera Connection</span>
                <span className="text-[10px] text-dark-400">Continuous feed face/yaw detection</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {cameraPermission === 'granted' && <span className="text-xs text-emerald-400 font-bold">✅ Camera connected</span>}
                {cameraPermission === 'denied' && <span className="text-xs text-rose-400 font-bold">❌ Access denied</span>}
                {cameraPermission === 'prompt' && (
                  <button
                    type="button"
                    onClick={requestCamera}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Grant Camera Permission
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-dark-900 border border-dark-600/10 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white">Screen Sharing Session</span>
                <span className="text-[10px] text-dark-400">Required virtual canvas tracking</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {screenPermission === 'granted' && <span className="text-xs text-emerald-400 font-bold">✅ Screen sharing active</span>}
                {screenPermission === 'denied' && <span className="text-xs text-rose-400 font-bold">❌ Access denied</span>}
                {screenPermission === 'prompt' && (
                  <button
                    type="button"
                    onClick={requestScreen}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Grant Screen Recording Permission
                  </button>
                )}
              </div>
            </div>
          </div>

          {(cameraPermission === 'denied' || screenPermission === 'denied') && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl flex flex-col gap-3 text-xs text-rose-300">
              <p>
                <strong>Integrity Access Blocked:</strong> Screen sharing and video stream parameters are mandatory to run the proctored examination. You cannot progress without these permissions.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCameraPermission('prompt');
                  setScreenPermission('prompt');
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg self-start transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4.5 h-4.5 rounded border-dark-600 bg-dark-950 text-brand-500 focus:ring-brand-500 mt-0.5 shrink-0"
            />
            <span className="text-xs text-dark-300 leading-normal">
              I understand and consent to being monitored during this session.
            </span>
          </label>

          <button
            type="button"
            disabled={!agreed || cameraPermission !== 'granted' || screenPermission !== 'granted' || isStartingViva}
            onClick={handleStartViva}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
          >
            {isStartingViva ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Starting Viva...</>
            ) : 'Start Viva'}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-8 py-6 select-none max-w-7xl mx-auto px-4">
      <CheatDetection 
        onSuspicion={logSuspicion} 
        cameraStream={cameraStream} 
        screenStream={screenStream} 
      />
      
      {/* Title Header with Widget Counters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="text-left max-w-xl">
          <span className="text-xs font-bold font-sans tracking-wide text-brand-300 uppercase select-none">
            Step 3 of 4: Viva Mode
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold font-sans text-white tracking-tight leading-tight mt-1 mb-2">
            Project: {projectDetails.title || selectedProjectTemplate?.rawTitle || 'Nexus Core Migration'}
          </h1>
          <p className="text-xs md:text-sm text-dark-300 font-sans leading-relaxed select-text">
            Live evaluation room. Validate technical depth skill-by-skill through targeted questioning. Anti-cheat monitoring is active.
          </p>
        </div>

        {/* Authenticity and Confidence header widgets (Screen 3 style) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Authenticity Widget */}
          <div className="bg-dark-900 border border-dark-600/35 rounded-xl px-5 py-2 flex flex-col items-center justify-center flex-shrink-0 select-none">
            <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-brand-400" />
              Authenticity Score
            </span>
            <span className="text-xl font-black text-white font-mono">{selectedProjectTemplate?.authenticityScore || 78}%</span>
          </div>

          {/* Skill Confidence Circle Widget */}
          {renderMiniConfidenceGauge(selectedProjectTemplate?.confidence || 85)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Left Sidebar: Skills Tracker */}
        <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2 border-b border-dark-600 pb-2">
            Skill Assessment
          </h3>
          <div className="flex flex-col gap-2">
            {allSkills.map((skill, idx) => {
              const isActive = currentSkill === skill.skill_name;
              return (
                <div 
                  key={idx}
                  className={`px-4 py-3 rounded-xl border ${
                    isActive 
                      ? 'bg-brand-500/10 border-brand-500/50 shadow-[0_0_15px_rgba(79,70,229,0.15)]' 
                      : 'bg-dark-900/50 border-dark-600/30'
                  }`}
                >
                  <span className={`text-sm font-bold block ${isActive ? 'text-brand-300' : 'text-dark-300'}`}>
                    {skill.skill_name}
                  </span>
                  <span className="text-xs text-dark-400 mt-1 block">
                    Confidence: {(skill.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6 w-full max-w-[1000px]">
          {!isVivaFinished && currentQuestion ? (
            <VivaQuestionCard
              question={currentQuestion}
              currentIndex={currentQuestionIdx}
              totalQuestions={vivaQuestions.length}
              timer={countdownTimer}
              userAnswer={vivaAnswers[currentQuestion.id] || ''}
              onAnswerChange={saveAnswerDraft}
              evaluateAndProceed={evaluateAndProceed}
            />
          ) : (
            <Card className="text-center py-16 px-6 border-brand-500/25 bg-brand-500/5 select-none h-full flex flex-col justify-center">
              {isGeneratingReport ? (
                <>
                  <Loader2 className="w-16 h-16 text-brand-400 mx-auto mb-4 animate-spin" />
                  <h2 className="text-2xl font-bold text-white mb-2">Analyzing Responses</h2>
                  <p className="text-sm text-dark-300 max-w-md mx-auto mb-6">
                    Our AI Proctor is processing all your answers and building your custom forensics report. Please wait...
                  </p>
                </>
              ) : (
                <>
                  <Award className="w-16 h-16 text-brand-400 mx-auto mb-4 animate-pulse-ring" />
                  <h2 className="text-2xl font-bold text-white mb-2">Viva Session Completed</h2>
                  <p className="text-sm text-dark-300 max-w-md mx-auto mb-6">
                    All skills have been evaluated. Please proceed to the final step to view the complete diagnostics report.
                  </p>
                  <button
                    type="button"
                    onClick={generateReport}
                    className="px-6 py-3 mx-auto rounded-xl text-xs font-bold tracking-wider text-white bg-brand-500 hover:bg-brand-600 hover:glow-button-shadow transition-all duration-300"
                  >
                    Generate Final Report
                  </button>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default VivaPage;
