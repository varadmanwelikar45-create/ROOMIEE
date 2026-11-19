import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Camera,
  BadgeCheck,
  Loader2,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Lock,
  RefreshCw,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Sun,
  ScanFace,
  ZoomIn,
} from 'lucide-react';
import { IdentityVerificationInfo, VerificationMethod } from '../types';
import { verifyIdentityProof } from '../services/identityVerifier';
import {
  analyzeSelfieImageFile,
  analyzeSelfieVideoFrame,
  SelfiePositionAnalysis,
} from '../utils/selfiePositionAnalyzer';

interface IdentityTrustPanelProps {
  identityVerification: IdentityVerificationInfo;
  emergencyContact?: string;
  onVerified: (nextVerification: IdentityVerificationInfo) => Promise<void> | void;
  onSaveEmergencyContact?: (contact: string) => Promise<void> | void;
}

const CENTERED_FRAMES_REQUIRED = 3;

export const IdentityTrustPanel: React.FC<IdentityTrustPanelProps> = ({
  identityVerification,
  emergencyContact = '',
  onVerified,
  onSaveEmergencyContact,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<Exclude<VerificationMethod, 'google_only'>>(
    'selfie_liveness'
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [checkFeedback, setCheckFeedback] = useState('');
  const [contactInput, setContactInput] = useState(emergencyContact);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactError, setContactError] = useState('');

  // Live Camera & Auto-Guidance states
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraDeniedFallback, setCameraDeniedFallback] = useState(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [positionAnalysis, setPositionAnalysis] = useState<SelfiePositionAnalysis | null>(null);
  const [centeredCount, setCenteredCount] = useState(0);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureLockRef = useRef(false);

  useEffect(() => {
    setContactInput(emergencyContact);
  }, [emergencyContact]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setVideoReady(false);
    setPositionAnalysis(null);
    setCenteredCount(0);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [cameraOpen]);

  const handleSelectMethod = (method: Exclude<VerificationMethod, 'google_only'>) => {
    setSelectedMethod(method);
    setCheckError('');
    setCheckFeedback('');
    setCameraDeniedFallback(false);
    setCapturedPreviewUrl(null);
    captureLockRef.current = false;
    if (method !== 'selfie_liveness') {
      stopCameraStream();
    }
  };

  const runVerification = useCallback(
    async (
      file: File,
      method: Exclude<VerificationMethod, 'google_only'>,
      clearPreviewOnPass = false
    ) => {
      setCheckError('');
      setCheckFeedback('');
      setIsChecking(true);
      try {
        const result = await verifyIdentityProof(file, method);
        if (!result.verified) {
          setCheckError(
            result.reason || 'Verification did not pass. Please take a clear photo in good lighting.'
          );
          return false;
        }

        const nextInfo: IdentityVerificationInfo = {
          identityVerified: true,
          verificationMethod: method,
          verifiedAt: new Date().toISOString(),
        };
        await onVerified(nextInfo);
        if (clearPreviewOnPass) {
          setCapturedPreviewUrl(null);
        }
        setCheckFeedback(result.reason || 'Identity verified.');
        return true;
      } catch (err) {
        setCheckError(
          err instanceof Error ? err.message : 'Identity verification failed. Please try again.'
        );
        return false;
      } finally {
        setIsChecking(false);
        captureLockRef.current = false;
      }
    },
    [onVerified]
  );

  const captureAndAnalyzeSelfie = useCallback(async () => {
    if (captureLockRef.current || isChecking) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    captureLockRef.current = true;
    setCheckError('');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      captureLockRef.current = false;
      setCheckError('Could not capture selfie frame. Please try again.');
      return;
    }

    // Mirror horizontally so the saved photo matches the live mirrored viewfinder
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const previewUrl = canvas.toDataURL('image/jpeg', 0.9);
    setIsChecking(true);
    setCapturedPreviewUrl(previewUrl);
    stopCameraStream();

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          captureLockRef.current = false;
          setIsChecking(false);
          setCheckError('Could not process captured selfie. Please retake.');
          return;
        }
        const file = new File([blob], `live-selfie-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        await runVerification(file, 'selfie_liveness', true);
      },
      'image/jpeg',
      0.9
    );
  }, [isChecking, runVerification, stopCameraStream]);

  // Continuous real-time face position & framing analysis while live camera is active
  useEffect(() => {
    if (!cameraOpen || !videoReady || isChecking) return;

    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
    }

    let cancelled = false;
    let timerId: number | undefined;

    const tick = async () => {
      if (cancelled || !videoRef.current || !analysisCanvasRef.current || captureLockRef.current) {
        return;
      }
      const analysis = await analyzeSelfieVideoFrame(videoRef.current, analysisCanvasRef.current);
      if (cancelled) return;

      setPositionAnalysis(analysis);

      if (analysis.centered) {
        setCenteredCount((prev) => {
          const next = prev + 1;
          if (autoCaptureEnabled && next >= CENTERED_FRAMES_REQUIRED && !captureLockRef.current) {
            void captureAndAnalyzeSelfie();
          }
          return next;
        });
      } else {
        setCenteredCount(0);
      }

      if (!cancelled && !captureLockRef.current) {
        timerId = window.setTimeout(tick, 240);
      }
    };

    timerId = window.setTimeout(tick, 180);

    return () => {
      cancelled = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [cameraOpen, videoReady, isChecking, autoCaptureEnabled, captureAndAnalyzeSelfie]);

  const startLiveCamera = async () => {
    if (isRequestingCamera || isChecking) return;

    setCheckError('');
    setCheckFeedback('');
    setCameraDeniedFallback(false);
    setCapturedPreviewUrl(null);
    setPositionAnalysis(null);
    setCenteredCount(0);
    setVideoReady(false);
    captureLockRef.current = false;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraDeniedFallback(true);
      return;
    }

    setIsRequestingCamera(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 720 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr) {
        const name = constraintErr instanceof DOMException ? constraintErr.name : '';
        if (
          name === 'OverconstrainedError' ||
          name === 'ConstraintNotSatisfiedError' ||
          name === 'NotFoundError'
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw constraintErr;
        }
      }

      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setCameraDeniedFallback(true);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCheckError(
          'Camera permission was denied. Allow camera access or take a selfie photo below.'
        );
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCheckError('Camera is busy in another app. Close it or upload a selfie photo below.');
      } else {
        setCheckError('Live camera unavailable on this device. Use Take / Upload Selfie below.');
      }
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isChecking) return;

    if (selectedMethod === 'selfie_liveness') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCapturedPreviewUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);

      const analysis = await analyzeSelfieImageFile(file);
      if (!analysis.centered && analysis.direction !== 'no_face') {
        setPositionAnalysis(analysis);
      }
      await runVerification(file, 'selfie_liveness', true);
      return;
    }

    await runVerification(file, selectedMethod);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveEmergencyContact || savingContact) return;
    setContactError('');
    setSavingContact(true);
    try {
      await onSaveEmergencyContact(contactInput.trim());
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2500);
    } catch {
      setContactError('Could not save safety contact right now. Please try again.');
    } finally {
      setSavingContact(false);
    }
  };

  const methodLabel = (m: VerificationMethod) => {
    switch (m) {
      case 'selfie_liveness':
        return 'Selfie Verified';
      case 'gov_id_ai_check':
        return 'Govt ID Verified';
      case 'workplace_id_ai_check':
        return 'Work / College ID Verified';
      default:
        return 'Not ID Verified';
    }
  };

  const renderDirectionIcon = () => {
    const dir = positionAnalysis?.direction;
    switch (dir) {
      case 'move_left':
        return <ArrowLeft className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'move_right':
        return <ArrowRight className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'move_up':
        return <ArrowUp className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'move_down':
        return <ArrowDown className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'move_closer':
        return <ZoomIn className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'more_light':
        return <Sun className="w-4 h-4 text-[#FFD43B] shrink-0" />;
      case 'centered':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      default:
        return <ScanFace className="w-4 h-4 text-[#FFD43B] shrink-0" />;
    }
  };

  const progressRatio = Math.min(100, Math.round((centeredCount / CENTERED_FRAMES_REQUIRED) * 100));

  return (
    <div className="bg-[#242424] border border-[#3d3d3d] rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#FFD43B]" />
          <span>Identity &amp; Safety</span>
        </h3>
        {identityVerification.identityVerified && (
          <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Verified</span>
          </span>
        )}
      </div>

      {/* Verification Status */}
      <div className="bg-[#2e2e2e] border border-[#3d3d3d] rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {identityVerification.identityVerified ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-[#8e8e8e] shrink-0" />
          )}
          <span className="font-semibold text-[#F5F5F5]">
            {methodLabel(identityVerification.verificationMethod)}
          </span>
        </div>
        {identityVerification.verifiedAt && (
          <span className="text-[11px] text-[#8e8e8e]">
            {new Date(identityVerification.verifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Verification Controls */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'selfie_liveness' as const, label: 'Live Selfie' },
            { id: 'gov_id_ai_check' as const, label: 'Govt ID' },
            { id: 'workplace_id_ai_check' as const, label: 'Work / College ID' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectMethod(opt.id)}
              className={`min-h-[40px] py-2 px-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap truncate ${
                selectedMethod === opt.id
                  ? 'bg-[#FFD43B] text-[#242424] border-[#FFD43B]'
                  : 'bg-[#303030] text-[#B8B8B8] border-[#444444] hover:text-[#F5F5F5]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {selectedMethod === 'selfie_liveness' ? (
          <div className="space-y-2.5">
            {/* Live Camera Stream Viewfinder with Real-Time Directional Guidance */}
            {cameraOpen && (
              <div className="bg-[#1b1b1b] border border-[#484848] rounded-2xl overflow-hidden space-y-3 p-3">
                <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => setVideoReady(true)}
                    onCanPlay={() => setVideoReady(true)}
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Face Guide Oval + Directional Cue Arrows */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`relative w-40 h-52 rounded-full border-2 border-dashed transition-colors ${
                        positionAnalysis?.centered
                          ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]'
                          : 'border-[#FFD43B]/80'
                      }`}
                    >
                      {positionAnalysis?.direction === 'move_left' && (
                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 bg-black/75 text-[#FFD43B] p-1.5 rounded-full">
                          <ArrowLeft className="w-4 h-4" />
                        </div>
                      )}
                      {positionAnalysis?.direction === 'move_right' && (
                        <div className="absolute -right-8 top-1/2 -translate-y-1/2 bg-black/75 text-[#FFD43B] p-1.5 rounded-full">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                      {positionAnalysis?.direction === 'move_up' && (
                        <div className="absolute left-1/2 -top-8 -translate-x-1/2 bg-black/75 text-[#FFD43B] p-1.5 rounded-full">
                          <ArrowUp className="w-4 h-4" />
                        </div>
                      )}
                      {positionAnalysis?.direction === 'move_down' && (
                        <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 bg-black/75 text-[#FFD43B] p-1.5 rounded-full">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Guidance Banner */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent">
                    <div
                      className={`mx-auto max-w-xs rounded-xl px-3 py-2 flex items-center justify-center gap-2 text-xs font-bold border ${
                        positionAnalysis?.centered
                          ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200'
                          : 'bg-[#242424]/90 border-[#FFD43B]/50 text-[#F5F5F5]'
                      }`}
                    >
                      {videoReady ? (
                        renderDirectionIcon()
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-[#FFD43B] shrink-0" />
                      )}
                      <span>
                        {videoReady
                          ? positionAnalysis?.instruction || 'Position your face inside the oval'
                          : 'Starting camera...'}
                      </span>
                    </div>

                    {autoCaptureEnabled && positionAnalysis?.centered && centeredCount > 0 && (
                      <div className="mt-1.5 mx-auto max-w-[180px] h-1 bg-black/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-200"
                          style={{ width: `${progressRatio}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-Capture Toggle & Instant Capture Buttons */}
                <div className="flex items-center justify-between text-[11px] text-[#B8B8B8] px-0.5">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCaptureEnabled}
                      onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
                      className="accent-[#FFD43B] w-3.5 h-3.5 rounded"
                    />
                    <span>Auto-capture &amp; analyze when centered</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="px-3.5 min-h-[44px] rounded-xl bg-[#303030] hover:bg-[#3a3a3a] text-[#F5F5F5] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    disabled={!videoReady || isChecking}
                    onClick={captureAndAnalyzeSelfie}
                    className="flex-1 min-h-[44px] rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{videoReady ? 'Capture & Analyze Now' : 'Starting Camera...'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Direct Selfie Analysis View (shown automatically right after capture or upload) */}
            {!cameraOpen && capturedPreviewUrl && (
              <div className="bg-[#1b1b1b] border border-[#484848] rounded-2xl overflow-hidden space-y-3 p-3">
                <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-black">
                  <img
                    src={capturedPreviewUrl}
                    alt="Captured live selfie"
                    className="w-full h-full object-cover"
                  />
                  {isChecking && (
                    <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-xs font-bold text-[#F5F5F5]">
                      <Loader2 className="w-6 h-6 animate-spin text-[#FFD43B]" />
                      <span>Analyzing live selfie...</span>
                    </div>
                  )}
                </div>

                {!isChecking && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCapturedPreviewUrl(null)}
                      className="px-3.5 min-h-[44px] rounded-xl bg-[#303030] hover:bg-[#3a3a3a] text-[#F5F5F5] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={startLiveCamera}
                      className="flex-1 min-h-[44px] rounded-xl bg-[#FFD43B] hover:bg-[#ffe066] text-[#242424] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retake Live Selfie</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Trigger Button to Request Live Camera Permission */}
            {!cameraOpen && !capturedPreviewUrl && (
              <button
                type="button"
                disabled={isRequestingCamera || isChecking}
                onClick={startLiveCamera}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-[#484848] hover:border-[#FFD43B] bg-[#2a2a2a] text-xs font-bold text-[#F5F5F5] hover:text-[#FFD43B] transition-colors cursor-pointer disabled:opacity-60"
              >
                {isRequestingCamera ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FFD43B]" />
                    <span>Requesting camera permission...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-[#FFD43B]" />
                    <span>
                      {identityVerification.identityVerified
                        ? 'Take New Live Selfie'
                        : 'Allow Camera & Take Live Selfie'}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Fallback when camera is blocked or unavailable */}
            {cameraDeniedFallback && !cameraOpen && !isChecking && (
              <label className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#303030] hover:bg-[#383838] border border-[#444444] text-xs font-semibold text-[#F5F5F5] cursor-pointer">
                <Camera className="w-4 h-4 text-[#FFD43B]" />
                <span>Take or Upload Selfie Photo Instead</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  capture="user"
                  disabled={isChecking}
                  onChange={handleUploadProof}
                  className="hidden"
                />
              </label>
            )}
          </div>
        ) : (
          <label
            className={`min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed text-xs font-bold transition-colors ${
              isChecking
                ? 'border-[#FFD43B]/60 bg-[#2a2a2a] text-[#FFD43B] cursor-wait'
                : 'border-[#484848] hover:border-[#FFD43B] bg-[#2a2a2a] text-[#F5F5F5] hover:text-[#FFD43B] cursor-pointer'
            }`}
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-[#FFD43B]" />
                <span>
                  {identityVerification.identityVerified
                    ? 'Update ID Photo'
                    : 'Upload ID Photo for Verification'}
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              disabled={isChecking}
              onChange={handleUploadProof}
              className="hidden"
            />
          </label>
        )}

        {checkFeedback && (
          <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700/60 p-2.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{checkFeedback}</span>
          </div>
        )}

        {checkError && (
          <div className="text-xs text-red-300 bg-red-950/45 border border-red-800 p-2.5 rounded-xl flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{checkError}</span>
          </div>
        )}
      </div>

      {/* Emergency Contact */}
      {onSaveEmergencyContact && (
        <form onSubmit={handleContactSubmit} className="pt-3 border-t border-[#383838] space-y-2">
          <label className="text-[11px] font-bold text-[#F5F5F5] flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5 text-[#FFD43B]" />
            <span>Emergency Contact</span>
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={contactInput}
              onChange={(e) => setContactInput(e.target.value)}
              placeholder="Parent or friend phone (+91 ...)"
              className="flex-1 min-h-[42px] px-3 py-2 bg-[#303030] border border-[#444444] rounded-xl text-xs text-[#F5F5F5] placeholder-[#777777] focus:outline-none focus:border-[#FFD43B]"
            />
            <button
              type="submit"
              disabled={savingContact}
              className="px-4 min-h-[42px] py-2 bg-[#383838] hover:bg-[#444444] text-[#FFD43B] text-xs font-bold rounded-xl border border-[#484848] cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {savingContact ? 'Saving...' : contactSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          {contactError && <p className="text-[11px] text-red-400">{contactError}</p>}
        </form>
      )}
    </div>
  );
};
