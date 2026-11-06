import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Video, MonitorUp, EyeOff } from 'lucide-react';

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

const CheatDetection = ({ onSuspicion, cameraStream, screenStream }) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [error, setError] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const [logs, setLogs] = useState([
    'System initialized',
    'Awaiting permissions...'
  ]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const screenRef = useRef(null);
  const logsEndRef = useRef(null);

  const faceModelRef = useRef(null);
  const ssdModelRef = useRef(null);

  useEffect(() => {
    const initAI = async () => {
      try {
        setLogs(prev => [...prev, 'Loading TF.js runtime...']);
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
        
        setLogs(prev => [...prev, 'Loading BlazeFace model...']);
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface');
        
        setLogs(prev => [...prev, 'Loading COCO-SSD object tracker...']);
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
        
        setLogs(prev => [...prev, 'Starting neural engines...']);
        
        if (window.blazeface && window.cocoSsd) {
          const faceModel = await window.blazeface.load();
          const ssdModel = await window.cocoSsd.load();
          
          faceModelRef.current = faceModel;
          ssdModelRef.current = ssdModel;
          
          setLogs(prev => [...prev, 'All AI models active.', 'Integrity shield active.']);
          setModelsLoaded(true);
        } else {
          throw new Error('TensorFlow globals unavailable');
        }
      } catch (err) {
        console.error('Failed to load TFJS proctor models:', err);
        setLogs(prev => [...prev, 'Warning: AI models offline. Running telemetry checks.']);
      }
    };
    
    initAI();
  }, []);

  useEffect(() => {
    if (!cameraStream || !screenStream) {
      setLogs(prev => [...prev, 'Waiting for camera/screen streams from consent flow...']);
      return;
    }

    streamRef.current = cameraStream;
    screenRef.current = screenStream;
    setPermissionsGranted(true);

    // Assign srcObject. If videoRef not mounted yet, assign after a tick.
    const assignVideo = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
    };
    assignVideo();
    const t = setTimeout(assignVideo, 100);

    const screenTrack = screenStream.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.onended = () => {
        setWarningReason('Screen sharing was stopped.');
        setShowWarning(true);
        if (onSuspicion) onSuspicion('Screen sharing was stopped mid-session.', 'Screen Share Stopped', 100);
      };
    }

    return () => clearTimeout(t);
  }, [cameraStream, screenStream, onSuspicion]);

  useEffect(() => {
    if (!permissionsGranted || !modelsLoaded) return;

    setLogs(prev => [
      ...prev,
      'Camera feed active',
      'Screen share active',
      'AI Proctoring mode: ON'
    ]);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Debouncing checks to avoid single frame noise
    let blockStreak = 0;
    let noFaceStreak = 0;
    let yawStreak = 0;
    let phoneStreak = 0;

    const checkFrame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      const video = videoRef.current;
      const width = video.videoWidth || 320;
      const height = video.videoHeight || 240;
      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(video, 0, 0, width, height);

      // 1. Camera Blocked Detection
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      let totalGray = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalGray += (data[i] + data[i+1] + data[i+2]) / 3;
      }
      const avgBrightness = totalGray / (data.length / 4);

      let sumSqDiff = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i+1] + data[i+2]) / 3;
        sumSqDiff += Math.pow(gray - avgBrightness, 2);
      }
      const variance = sumSqDiff / (data.length / 4);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (avgBrightness < 12 && variance < 15) {
        blockStreak++;
        if (blockStreak >= 3) {
          setLogs(prev => [...prev.slice(-15), `[${timestamp}] ISSUE: Camera blocked`]);
          onSuspicion('Camera appears blocked or covered.', 'Camera Blocked', 100);
        }
      } else {
        blockStreak = 0;
      }

      // 2. Face Presence & Head Pose Yaw (BlazeFace)
      if (faceModelRef.current) {
        try {
          const predictions = await faceModelRef.current.estimateFaces(video, false);

          if (predictions.length === 0) {
            noFaceStreak++;
            if (noFaceStreak >= 4) {
              setLogs(prev => [...prev.slice(-15), `[${timestamp}] ISSUE: No face detected`]);
              onSuspicion('No face detected in video frame.', 'No Face Detected', 100);
            }
          } else {
            noFaceStreak = 0;

            if (predictions.length > 1) {
              setLogs(prev => [...prev.slice(-15), `[${timestamp}] ISSUE: Multiple faces detected`]);
              onSuspicion('Multiple faces detected in proctoring frame.', 'Multiple Faces', 100);
            } else {
              // Gaze & Head Yaw ratio estimation
              const landmarks = predictions[0].landmarks;
              if (landmarks && landmarks.length >= 6) {
                const noseX = landmarks[2][0];
                const leftEyeX = landmarks[1][0];
                const rightEyeX = landmarks[0][0];

                const dxLeft = Math.abs(noseX - leftEyeX);
                const dxRight = Math.abs(rightEyeX - noseX);

                const ratio = dxLeft > 0 && dxRight > 0 ? dxLeft / dxRight : 1.0;

                if (ratio < 0.35 || ratio > 2.8) {
                  yawStreak++;
                  if (yawStreak >= 3) {
                    setLogs(prev => [...prev.slice(-15), `[${timestamp}] ISSUE: Gaze deviated`]);
                    onSuspicion('Candidate looking away from screen (yaw ratio anomaly).', 'Gaze Deviation', 85);
                  }
                } else {
                  yawStreak = 0;
                  if (Math.random() > 0.9) {
                    setLogs(prev => [...prev.slice(-15), `[${timestamp}] OK: Gaze nominal`]);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      // 3. Phone Detection (COCO-SSD)
      if (ssdModelRef.current) {
        try {
          const predictions = await ssdModelRef.current.detect(video);
          const cellPhone = predictions.find(p => p.class === 'cell phone');
          if (cellPhone) {
            phoneStreak++;
            if (phoneStreak >= 2) {
              const conf = Math.round(cellPhone.score * 100);
              setLogs(prev => [...prev.slice(-15), `[${timestamp}] ISSUE: Phone detected (${conf}%)`]);
              onSuspicion(`Cell phone detected in video frame.`, 'Phone Detected', conf);
            }
          } else {
            phoneStreak = 0;
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    const interval = setInterval(checkFrame, 1500);
    return () => clearInterval(interval);
  }, [permissionsGranted, modelsLoaded, onSuspicion]);

  const triggerWarning = (reason) => {
    setWarningReason(reason);
    setShowWarning(true);
    if (onSuspicion) {
      onSuspicion(reason, 'Environment anomaly', 100);
    }
  };

  // Scroll logs terminal to bottom on new entries
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerWarning('Tab switched or browser minimized.');
      }
    };

    const handleBlur = () => {
      triggerWarning('Window lost focus.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissWarning = () => {
    setShowWarning(false);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 w-[340px] h-[130px] rounded-2xl overflow-hidden border border-brand-500/30 z-40 bg-dark-900 flex shadow-[0_4px_30px_rgba(0,0,0,0.5)] p-2 gap-2 backdrop-blur-md">
        {/* Left Side: Camera Video Feed */}
        <div className="w-[100px] h-full rounded-xl overflow-hidden bg-dark-950 flex flex-col items-center justify-center border border-dark-800 shrink-0 relative">
          {permissionsGranted ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-90" />
          ) : (
            <div className="flex flex-col items-center gap-1 p-1 text-center">
              <Video className="w-4 h-4 text-dark-400" />
              <span className="text-[8px] text-dark-300">No Cam Feed</span>
            </div>
          )}
          {permissionsGranted && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
              <span className="text-[7px] font-bold text-green-400 uppercase tracking-widest">LIVE</span>
            </div>
          )}
        </div>

        {/* Right Side: AI Proctor Live Logs Console */}
        <div className="flex-1 h-full flex flex-col gap-1.5 justify-between">
          <div className="flex items-center justify-between border-b border-dark-800 pb-1">
            <span className="text-[9px] font-black text-brand-300 uppercase tracking-widest flex items-center gap-1 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              AI Proctor Console
            </span>
            <span className="text-[7px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded border border-brand-500/20 font-bold uppercase tracking-wider select-none">
              Active
            </span>
          </div>

          <div 
            ref={logsEndRef}
            className="flex-1 bg-dark-950 border border-dark-800/60 p-1.5 rounded-lg font-mono text-[8px] text-dark-300 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-dark-800"
          >
            {logs.map((log, i) => {
              const isIssue = log.includes('ISSUE:');
              return (
                <div key={i} className={`leading-normal border-l-2 pl-1 ${isIssue ? 'border-red-500 text-red-400 bg-red-500/5' : 'border-emerald-500 text-emerald-400/90'}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-dark-900 border border-red-500/50 rounded-xl p-8 max-w-md w-full mx-4 shadow-[0_0_40px_rgba(239,68,68,0.2)] flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">Cheat Detection Alert</h2>
            <p className="text-sm text-red-300 mb-6 font-sans">
              We detected a deviation from the testing environment:
              <br />
              <strong className="text-white mt-2 block bg-red-500/20 px-3 py-1.5 rounded">{warningReason}</strong>
            </p>
            <p className="text-xs text-dark-300 mb-6 max-w-[250px] leading-relaxed">
              This event has been logged in the suspicion tracking matrix. Repeated deviations may invalidate your evaluation.
            </p>
            <button
              onClick={dismissWarning}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all duration-300 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
            >
              Acknowledge and Return
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CheatDetection;