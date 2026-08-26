import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Upload, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  studentName?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  studentName,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize camera
  const startCamera = async (facing: 'user' | 'environment') => {
    setIsLoading(true);
    setCameraError(null);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Camera permission was not granted or camera is not available. You can upload a photo from your gallery instead.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(facingMode);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Stop camera when closing
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCapturedImage(null);
    setCameraError(null);
    onClose();
  };

  // Switch camera front/back
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // Take snapshot
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw centered square crop
    const sx = ((video.videoWidth || 480) - size) / 2;
    const sy = ((video.videoHeight || 480) - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);

    // Stop live stream to save battery
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Retake
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  };

  // File upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target?.result) {
          setCapturedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-5 py-4">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-slate-800">
              {studentName ? `Take Photo: ${studentName}` : 'Take Student Photo'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-slate-400 hover:bg-orange-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative aspect-square w-full bg-slate-900 flex items-center justify-center overflow-hidden">
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured Student Preview"
              className="h-full w-full object-cover"
            />
          ) : cameraError ? (
            <div className="p-6 text-center text-white">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-400" />
              <p className="text-sm font-medium">{cameraError}</p>
              <label className="mt-4 inline-flex cursor-pointer items-center space-x-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-700">
                <Upload className="h-4 w-4" />
                <span>Upload From Device</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Center Portrait Guide Frame */}
              <div className="pointer-events-none absolute inset-8 rounded-full border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"></div>
              <div className="pointer-events-none absolute bottom-4 text-center text-xs text-white/80 drop-shadow">
                Position face inside the circle
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Action Controls */}
        <div className="border-t border-slate-100 bg-white p-4">
          {capturedImage ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-3 text-sm font-semibold text-white shadow-md hover:from-orange-600 hover:to-amber-700"
              >
                <Check className="h-4 w-4" />
                <span>Use This Photo</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-around">
              {/* File upload fallback */}
              <label className="flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-orange-600 p-2">
                <Upload className="h-5 w-5" />
                <span className="text-[11px] mt-1 font-medium">Gallery</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={takePhoto}
                disabled={Boolean(cameraError) || isLoading}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-orange-200 bg-orange-600 p-1 text-white shadow-lg active:scale-95 disabled:opacity-50"
              >
                <div className="h-12 w-12 rounded-full border-2 border-white bg-orange-500 hover:bg-orange-400"></div>
              </button>

              {/* Switch Camera */}
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={Boolean(cameraError)}
                className="flex flex-col items-center justify-center text-slate-500 hover:text-orange-600 p-2 disabled:opacity-40"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="text-[11px] mt-1 font-medium">Flip</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
