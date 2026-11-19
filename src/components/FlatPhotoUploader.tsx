import React, { useState } from 'react';
import {
  Home,
  Upload,
  ShieldAlert,
  Loader2,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  verifyAndCompressFlatPhoto,
  FlatPhotoVerificationResult,
} from '../services/flatPhotoVerifier';

interface FlatPhotoUploaderProps {
  flatPhotos: string[];
  onChange: (nextPhotos: string[]) => Promise<void> | void;
  maxPhotos?: number;
  disabled?: boolean;
  compact?: boolean;
}

export const FlatPhotoUploader: React.FC<FlatPhotoUploaderProps> = ({
  flatPhotos,
  onChange,
  maxPhotos = 3,
  disabled = false,
  compact = false,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [rejectedReport, setRejectedReport] = useState<FlatPhotoVerificationResult | null>(null);
  const [lastVerifiedMsg, setLastVerifiedMsg] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isScanning || disabled) return;

    if (flatPhotos.length >= maxPhotos) {
      setScanError(`You can share up to ${maxPhotos} verified flat photos.`);
      return;
    }

    setScanError('');
    setRejectedReport(null);
    setLastVerifiedMsg('');
    setIsScanning(true);

    try {
      const result = await verifyAndCompressFlatPhoto(file);
      if (!result.accepted || !result.compressedDataUrl) {
        setRejectedReport(result);
        return;
      }

      const next = [...flatPhotos, result.compressedDataUrl].slice(0, maxPhotos);
      await onChange(next);
      setLastVerifiedMsg(result.reason || 'Verified real flat photo added.');
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Could not inspect this flat photo. Please try again.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleRemove = async (indexToRemove: number) => {
    if (isScanning || disabled) return;
    setScanError('');
    setRejectedReport(null);
    setLastVerifiedMsg('');
    const next = flatPhotos.filter((_, idx) => idx !== indexToRemove);
    await onChange(next);
  };

  return (
    <div className={compact ? 'space-y-3' : 'bg-[#242424] p-4 rounded-2xl border border-[#3d3d3d] space-y-3'}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-[#FFD43B] flex items-center gap-1.5">
          <Home className="w-4 h-4 text-[#FFD43B]" />
          <span>Flat Photos ({flatPhotos.length}/{maxPhotos})</span>
        </label>
        <p className="text-[11px] text-[#B8B8B8] mt-0.5">
          Add real photos of your room, living area, or balcony.
        </p>
      </div>

      {/* Uploaded Flat Photos Grid */}
      {flatPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {flatPhotos.map((src, idx) => (
            <div
              key={`${idx}-${src.slice(-16)}`}
              className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[#484848] bg-[#1e1e1e] group shadow-md"
            >
              <img
                src={src}
                alt={`Flat photo ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                disabled={isScanning || disabled}
                onClick={() => handleRemove(idx)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                title="Remove flat photo"
                aria-label={`Remove flat photo ${idx + 1}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dropzone Button */}
      {flatPhotos.length < maxPhotos && (
        <label
          className={`flex items-center justify-center gap-2.5 py-3 px-4 border-2 border-dashed rounded-xl text-xs font-semibold transition-all ${
            isScanning || disabled
              ? 'border-[#FFD43B]/60 bg-[#2a2a2a] text-[#FFD43B] cursor-wait'
              : 'border-[#484848] hover:border-[#FFD43B] bg-[#2a2a2a] hover:bg-[#323232] text-[#F5F5F5] hover:text-[#FFD43B] cursor-pointer'
          }`}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#FFD43B]" />
              <span>Scanning image with AI-generated photo detector...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-[#FFD43B]" />
              <span>
                {flatPhotos.length === 0
                  ? 'Upload Real Photo of Your Flat / Room'
                  : `Add Another Flat Photo (${flatPhotos.length}/${maxPhotos})`}
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isScanning || disabled}
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}

      {/* Verification Success Note */}
      {lastVerifiedMsg && !rejectedReport && !scanError && (
        <div className="bg-emerald-950/35 border border-emerald-700/60 rounded-xl p-2.5 flex items-start gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{lastVerifiedMsg}</span>
        </div>
      )}

      {/* AI-Generated / Non-Real Image Rejection Alert */}
      {rejectedReport && (
        <div className="bg-red-950/45 border border-red-700 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-red-300">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              {rejectedReport.isAiGenerated
                ? 'AI-Generated Flat Image Rejected'
                : !rejectedReport.isFlatRelated
                  ? 'Not a Valid Flat / Room Photo'
                  : 'Synthetic or Unverified Image Rejected'}
            </span>
          </div>
          <p className="text-red-200/90 leading-relaxed">{rejectedReport.reason}</p>
          {rejectedReport.detectedIndicators.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {rejectedReport.detectedIndicators.map((ind) => (
                <span
                  key={ind}
                  className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 border border-red-700/70 text-red-200 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{ind}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service / File Error */}
      {scanError && (
        <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800 font-medium">
          {scanError}
        </p>
      )}
    </div>
  );
};
