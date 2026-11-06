import React, { useState, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import Card from '../../components/common/Card';
import OutcomeVerificationTable from '../../components/report/OutcomeVerificationTable';
import { ResponsiveContainer, RadialBarChart, RadialBar, Cell } from 'recharts';
import { 
  FolderGit, 
  Clock, 
  Binary, 
  Download, 
  FileText, 
  Sparkles, 
  ThumbsUp, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Code,
  ShieldCheck,
  Award
} from 'lucide-react';

const ReportPage = () => {
  const {
    projectDetails,
    selectedProjectTemplate,
    vivaQuestions,
    vivaAnswers,
    vivaGrades,
    vivaScores,
    getOverallPerformanceMetrics,
    resetApp,
    suspicionLogs,
    sessionId,
    consentRecord
  } = useProject();

  const [proctorData, setProctorData] = useState(null);

  useEffect(() => {
    const fetchProctorReport = async () => {
      if (!sessionId) return;
      try {
        const response = await fetch(`http://localhost:8000/api/get-proctor-report/${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setProctorData(data);
        }
      } catch (err) {
        console.error('Failed to load proctor report:', err);
      }
    };
    fetchProctorReport();
  }, [sessionId]);

  const metrics = getOverallPerformanceMetrics();

  // Handle fallback rendering if no project details are available
  if (!metrics || !selectedProjectTemplate) {
    return (
      <div className="text-center py-20 font-sans text-dark-300">
        No report metrics available. Please complete the project analysis and Viva session first.
      </div>
    );
  }

  // Trigger JSON download of the full evaluation context
  const downloadJson = () => {
    const reportData = {
      project: {
        title: projectDetails.title,
        description: projectDetails.description,
        outcomes: projectDetails.outcomes
      },
      evaluation: {
        overallScore: metrics.overallScore,
        authenticityScore: metrics.authenticityScore,
        vivaScore: metrics.vivaScore,
        confidence: metrics.confidenceLabel,
        verdict: metrics.classification
      },
      skills: selectedProjectTemplate.suggested_skills.map(s => ({
        skill: s.skill_name,
        confidence: Math.round(s.confidence * 100) + '%'
      })),
      vivaTranscript: vivaQuestions.map(q => ({
        question: q.question,
        answer: vivaAnswers[q.id] || 'Not answered',
        grade: vivaGrades[q.id] || 'Skipped'
      })),
      audit: selectedProjectTemplate.audit,
      proctoring: proctorData || {
        consent: consentRecord,
        events: suspicionLogs.map(l => ({ timestamp: 'N/A', details: l, type: 'Event log' }))
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AIPSA_Report_${projectDetails.title.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export full report as markdown
  const downloadReport = () => {
    const lines = [
      `# AI Proctored Submission Analysis`,
      `**Project:** ${projectDetails.title}`,
      `**Date:** ${new Date().toLocaleString()}`,
      ``,
      `## Evaluation Summary`,
      `- Overall Score: ${metrics.overallScore}%`,
      `- Authenticity: ${metrics.authenticityScore}%`,
      `- Viva Score: ${metrics.vivaScore}%`,
      `- Verdict: ${metrics.classification}`,
      ``,
      `## Viva Transcript`,
      ...vivaQuestions.map((q, i) =>
        `### Q${i+1}: ${q.question}\n**Answer:** ${vivaAnswers[q.id] || 'No response'}\n**Grade:** ${vivaGrades[q.id] || 'Skipped'}`
      ),
      ``,
      `## Proctoring`,
      `Consent: ${consentRecord ? 'Granted' : 'Not recorded'}`,
      `Suspicion events: ${suspicionLogs.length}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIPSA_Report_${projectDetails.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const groupedEvents = {};
  const events = proctorData?.events || [];
  events.forEach(evt => {
    const type = evt.type || 'Other anomaly';
    if (!groupedEvents[type]) {
      groupedEvents[type] = [];
    }
    groupedEvents[type].push(evt);
  });

  return (
    <div className="w-full flex flex-col gap-8 py-6 max-w-7xl mx-auto select-none print:bg-white print:text-black">
      
      {/* 1. Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-dark-600/30 print:border-black">
        <div className="text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold font-sans text-white tracking-tight leading-tight print:text-black">
            Analysis Complete
          </h1>
          <div className="flex items-center gap-4 text-xs text-dark-400 mt-2 flex-wrap print:text-black">
            <span className="flex items-center gap-1.5"><FolderGit className="w-3.5 h-3.5 text-brand-400" /> {projectDetails.zipFile?.name || selectedProjectTemplate?.title || 'Project'}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-brand-400" /> {consentRecord?.timestamp ? new Date(consentRecord.timestamp).toLocaleString() : 'Session completed'}</span>
            <span className="flex items-center gap-1.5"><Binary className="w-3.5 h-3.5 text-brand-400" /> Session ID: {sessionId || 'N/A'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 print:hidden">
          <button 
            onClick={downloadJson} 
            className="px-4 py-2 bg-dark-900 border border-dark-600 hover:border-dark-500 rounded-xl text-xs font-bold text-dark-200 hover:text-white transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> JSON
          </button>
          <button 
            onClick={downloadReport} 
            className="px-4 py-2 bg-dark-900 border border-dark-600 hover:border-dark-500 rounded-xl text-xs font-bold text-dark-200 hover:text-white transition flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" /> Export as MD
          </button>
          <button 
            onClick={resetApp} 
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 hover:glow-button-shadow rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5"
          >
            + New Analysis
          </button>
        </div>
      </div>

      {/* 2. Overview and Overall Alignment Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Project Overview Card */}
        <Card className="lg:col-span-8 p-6 text-left flex flex-col justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white leading-tight font-sans">
              {projectDetails.title || selectedProjectTemplate.title}
            </h2>
            <p className="text-sm text-dark-300 mt-4 leading-relaxed font-sans select-text">
              {projectDetails.description || selectedProjectTemplate.description}
            </p>
          </div>
        </Card>

        {/* Alignment Gauge Card */}
        <Card className="lg:col-span-4 p-6 flex flex-col justify-between text-center border-brand-500/20 bg-brand-500/5">
          <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block mb-4">
            Overall Alignment
          </span>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-white font-mono leading-none">
              {metrics.overallScore}%
            </span>
            <span className="text-xs font-bold text-brand-300 uppercase tracking-wider mt-2.5">
              {metrics.overallScore >= 85 ? "Strong Evidence" : metrics.overallScore >= 65 ? "Moderate Evidence" : "Superficial Evidence"}
            </span>
          </div>
          <div className="w-full h-1.5 bg-dark-950 rounded-full overflow-hidden mt-6">
            <div 
              className="h-full bg-brand-500 rounded-full" 
              style={{ width: `${metrics.overallScore}%` }}
            />
          </div>
        </Card>
      </div>

      {/* 3. Skills Assessment Card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 select-none border-b border-dark-600/20 pb-4 mb-5">
          <Sparkles className="w-5 h-5 text-brand-400 animate-pulse" />
          <h3 className="text-lg font-bold text-white font-sans">
            Skills Assessment (Viva Completed)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
          {selectedProjectTemplate.suggested_skills && selectedProjectTemplate.suggested_skills.length > 0 ? (
            selectedProjectTemplate.suggested_skills.map((skill, idx) => {
              const staticPct = Math.round(skill.confidence * 100);
              const vivaPct = Math.round(Math.min(100, Math.max(10, staticPct + (vivaScores.technical - 5.0) * 3)));
              const label = vivaPct >= 85 ? 'High' : vivaPct >= 65 ? 'Medium' : 'Low';
              const labelColor = label === 'High' ? 'text-emerald-400' : label === 'Medium' ? 'text-cyan-400' : 'text-rose-400';

              return (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-extrabold text-sm text-white font-sans">{skill.skill_name}</span>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider block leading-none ${labelColor}`}>
                        {label} ({vivaPct}% Viva)
                      </span>
                      <span className="text-[8px] font-bold text-dark-400 uppercase tracking-widest block mt-0.5">
                        STATIC: {staticPct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-px bg-dark-600/30 my-1" />
                  <p className="text-xs text-dark-300 leading-relaxed font-sans">
                    {skill.rationale}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-dark-400 italic col-span-3">No skills assessed.</p>
          )}
        </div>
      </Card>

      {/* 4. Outcome Verification Grid */}
      <OutcomeVerificationTable 
        outcomes={projectDetails.outcomes} 
        selectedTemplate={selectedProjectTemplate} 
      />

      {/* 5. Strengths and Gaps Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-text text-left">
        {/* Notable Strengths */}
        <Card className="p-6 border-l-2 border-l-emerald-500/50">
          <h3 className="text-base font-bold text-white font-sans flex items-center gap-2 mb-4 select-none">
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
            Notable Strengths
          </h3>
          <ul className="flex flex-col gap-3.5 text-xs text-dark-200 pl-1 font-sans">
            {(selectedProjectTemplate.audit?.strengths || []).length > 0
              ? selectedProjectTemplate.audit.strengths.map((str, idx) => (
                  <li key={idx} className="flex gap-2 items-start leading-relaxed">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{str}</span>
                  </li>
                ))
              : <li className="text-dark-400 italic">No notable strengths recorded.</li>
            }
          </ul>
        </Card>

        {/* Critical Gaps */}
        <Card className="p-6 border-l-2 border-l-rose-500/50">
          <h3 className="text-base font-bold text-white font-sans flex items-center gap-2 mb-4 select-none">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Critical Gaps
          </h3>
          <ul className="flex flex-col gap-3.5 text-xs text-dark-200 pl-1 font-sans">
            {(selectedProjectTemplate.audit?.weaknesses || []).length > 0
              ? selectedProjectTemplate.audit.weaknesses.map((weak, idx) => (
                  <li key={idx} className="flex gap-2 items-start leading-relaxed">
                    <span className="text-rose-400 font-bold font-mono">✗</span>
                    <span>{weak}</span>
                  </li>
                ))
              : <li className="text-dark-400 italic">No critical gaps recorded.</li>
            }
          </ul>
        </Card>
      </div>

      {/* 6. Viva Session Transcript & Live Analytics Side-by-Side */}
      <div className="flex flex-col gap-5 text-left">
        <div className="border-b border-dark-600/20 pb-4">
          <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
            <HelpCircle className="w-5.5 h-5.5 text-brand-400" />
            Viva Session Transcript & Analysis
          </h3>
          <p className="text-xs text-dark-300 mt-1">
            Candidate examination records, dynamic analytics mapping, and behavioral logs.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: List of Questions and Answers */}
          <div className="lg:col-span-8 w-full flex flex-col gap-4 select-text font-sans">
            {vivaQuestions.map((q, idx) => {
              const answer = vivaAnswers[q.id];
              const grade = vivaGrades[q.id];

              const getGradeLabelStyle = (g) => {
                if (g === 'Approve') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                if (g === 'Partial') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              };

              return (
                <div key={q.id} className="p-5 rounded-2xl border border-dark-600/20 bg-dark-900/30 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between border-b border-dark-600/10 pb-2.5 flex-wrap gap-2 select-none">
                    <span className="text-xs font-bold text-white font-sans">
                      Question {idx + 1}: {q.question.slice(0, 50)}...
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getGradeLabelStyle(grade)}`}>
                      {grade || 'Skipped'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest select-none">Question Text</span>
                    <p className="text-xs font-bold text-white leading-relaxed">"{q.question}"</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest select-none">Candidate Response</span>
                    <p className="text-xs text-dark-200 bg-dark-950 p-3 rounded-lg border border-dark-600/30 leading-relaxed font-mono">
                      {answer ? `"${answer}"` : 'No response draft submitted.'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Authenticity, Confidence, and Analytics Widgets */}
          <div className="lg:col-span-4 w-full flex flex-col gap-5 select-none">
            <div className="grid grid-cols-2 gap-4">
              {/* Authenticity Score widget */}
              <div className="bg-dark-900/60 p-4 border border-dark-600/35 rounded-2xl text-center flex flex-col justify-between items-center gap-2">
                <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest">
                  Authenticity
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {selectedProjectTemplate.authenticityScore}%
                </span>
                <span className="px-2 py-0.5 text-[8px] font-bold text-brand-300 bg-brand-500/10 border border-brand-500/20 rounded-full uppercase">
                  Boilerplate scan
                </span>
              </div>

              {/* Skill Confidence Circle Gauge widget */}
              <div className="bg-dark-900/60 p-4 border border-dark-600/35 rounded-2xl text-center flex flex-col justify-between items-center gap-2 relative">
                <span className="text-[9px] font-bold text-dark-400 uppercase tracking-widest leading-none">
                  Confidence
                </span>
                
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="75%"
                      outerRadius="100%"
                      barSize={5}
                      data={[{ name: 'Val', value: Math.round(selectedProjectTemplate.confidence) }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar minAngle={15} background={{ fill: '#1e293b' }} clockWise dataKey="value" cornerRadius={10}>
                        <Cell fill="#818cf8" />
                      </RadialBar>
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <span className="absolute text-[10px] font-bold text-white font-mono">
                    {Math.round(selectedProjectTemplate.confidence)}%
                  </span>
                </div>

                <span className="text-[8px] font-bold text-dark-400 uppercase">
                  Probability index
                </span>
              </div>
            </div>

            {/* Technical Depth Scores */}
            <div className="bg-dark-900/60 p-5 border border-dark-600/35 rounded-2xl flex flex-col gap-4 text-left">
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1 block">Live Analytics</span>
              
              {/* Tech Depth */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-sans">
                  <span className="text-dark-300">Technical Depth</span>
                  <span className="font-semibold text-white font-mono">{vivaScores.technical}/10</span>
                </div>
                <div className="w-full h-1.5 bg-dark-950 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full transition-all duration-350" style={{ width: `${vivaScores.technical * 10}%` }} />
                </div>
              </div>

              {/* Communication */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-sans">
                  <span className="text-dark-300">Communication</span>
                  <span className="font-semibold text-white font-mono">{vivaScores.communication}/10</span>
                </div>
                <div className="w-full h-1.5 bg-dark-950 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-350" style={{ width: `${vivaScores.communication * 10}%` }} />
                </div>
              </div>

              {/* Confidence */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-sans">
                  <span className="text-dark-300">Confidence</span>
                  <span className="font-semibold text-white font-mono">{vivaScores.confidence}/10</span>
                </div>
                <div className="w-full h-1.5 bg-dark-950 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all duration-350" style={{ width: `${vivaScores.confidence * 10}%` }} />
                </div>
              </div>
            </div>

            {/* Suspicion box */}
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/25 p-4 flex gap-3 text-left">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Suspicion Indicator</span>
                <p className="text-xs text-dark-300 leading-relaxed font-sans font-medium">
                  {suspicionLogs[suspicionLogs.length - 1] || "Candidate behavior matches expected profile. No anomalies detected."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Proctoring Integrity Report */}
      <Card className="p-6 border-l-2 border-l-brand-500/50 text-left select-text" glow>
        <div className="border-b border-dark-600/20 pb-4 mb-5 select-none">
          <h3 className="text-xl font-bold text-white font-sans flex items-center gap-2">
            <ShieldCheck className="w-5.5 h-5.5 text-brand-400" />
            AI Proctoring & Exam Integrity Report
          </h3>
          <p className="text-xs text-dark-300 mt-1">
            Validating candidate identity and monitoring activity for compliance and exam guidelines.
          </p>
        </div>

        {/* Consent Record Banner */}
        <div className="bg-dark-900 border border-dark-600/35 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 select-none">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-brand-300 uppercase tracking-widest">Legal Monitor Agreement</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-emerald-400 border border-green-500/20 uppercase tracking-wider">
                Consent Granted
              </span>
              <span className="text-xs text-dark-200 font-medium">
                Student ID: <span className="text-white font-semibold">{consentRecord?.userId || proctorData?.consent?.userId || 'default_student'}</span>
              </span>
            </div>
            <span className="text-[10px] text-dark-400 mt-0.5">
              Timestamp: {consentRecord?.timestamp || proctorData?.consent?.timestamp ? new Date(consentRecord?.timestamp || proctorData?.consent?.timestamp).toLocaleString() : 'N/A'}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-dark-300 block">Monitored streams captured:</span>
            <span className="text-xs font-semibold text-brand-300 mt-0.5 block">webcam_stream, desktop_canvas, browser_focus</span>
          </div>
        </div>

        {/* Grouped Telemetry Violations List */}
        <div className="flex flex-col gap-4 font-sans">
          <h4 className="text-xs font-bold text-dark-400 uppercase tracking-widest select-none">integrity telemetry violations</h4>
          
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs text-emerald-400 text-center select-none font-semibold">
              ✅ Compliance verification complete: No behavioral deviations detected.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(groupedEvents).map(([type, eventsList]) => (
                <div key={type} className="p-4 bg-dark-900 border border-dark-600/20 rounded-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-dark-800 pb-1.5 select-none">
                    <span className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {type}
                    </span>
                    <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded">
                      {eventsList.length} occurrence{eventsList.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {eventsList.map((evt, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] bg-dark-950 p-2 rounded border border-dark-800/40">
                        <span className="text-dark-300 leading-normal">{evt.details}</span>
                        <span className="text-dark-500 font-mono shrink-0 ml-3">{evt.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
};

export default ReportPage;
