import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

const AttentionContext = createContext();

export function useAttention() {
  return useContext(AttentionContext);
}

export function AttentionProvider({ children }) {
  const [isLooking, setIsLooking] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedMood, setDetectedMood] = useState('neutral');

  // We maintain activeReadingTime globally
  // This acts like a 'Date.now()' that only ticks up when user is looking
  const activeReadingTimeRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());
  const intervalRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const reqAnimRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // Auto start camera on mount removed based on user request.

  // Accumulate activeReading time
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      // If camera is enabled, we only increment active time when looking.
      // If camera is disabled, it acts as normal (always active) to not break existing usage.
      if (!cameraEnabled || isLooking) {
        activeReadingTimeRef.current += delta;
      }
    }, 100);

    return () => clearInterval(intervalRef.current);
  }, [isLooking, cameraEnabled]);

  const initVisionAndCamera = async () => {
    try {
      setIsLoading(true);
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      detectorRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });

      setIsLoaded(true);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraEnabled(true);
      }
    } catch (e) {
      console.error("Camera/Vision init failed:", e);
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const predictWebcam = async () => {
    const video = videoRef.current;
    const detector = detectorRef.current;

    if (video && detector && video.readyState >= 2) {
      if (lastVideoTimeRef.current !== video.currentTime) {
        lastVideoTimeRef.current = video.currentTime;
        const results = detector.detectForVideo(video, performance.now());

        // Draw Face Mesh
        if (canvasRef.current && video.videoWidth) {
          const canvas = canvasRef.current;
          if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const canvasCtx = canvas.getContext('2d');
          canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
          if (results.faceLandmarks) {
            const drawingUtils = new DrawingUtils(canvasCtx);
            for (const landmarks of results.faceLandmarks) {
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: '#FF3030' });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: '#FF3030' });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: '#30FF30' });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: '#30FF30' });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: '#E0E0E0' });
              drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: '#E0E0E0' });
            }
          }
        }

        if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
          // A face is visible
          setIsLooking(true);

          // Detect mood from blendshapes
          const shapes = results.faceBlendshapes[0].categories;
          const smileLeft = shapes.find(s => s.categoryName === 'mouthSmileLeft')?.score || 0;
          const smileRight = shapes.find(s => s.categoryName === 'mouthSmileRight')?.score || 0;

          if (smileLeft > 0.4 || smileRight > 0.4) {
            setDetectedMood('happy');
          } else {
            setDetectedMood('neutral');
          }
        } else {
          setIsLooking(false);
          setDetectedMood('neutral');
        }
      }
    }

    if (cameraEnabled) {
      reqAnimRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  useEffect(() => {
    if (cameraEnabled && isLoaded) {
      reqAnimRef.current = requestAnimationFrame(predictWebcam);
    }
    return () => {
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
    }
  }, [cameraEnabled, isLoaded]); // eslint-disable-line

  const toggleCamera = () => {
    if (cameraEnabled) {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setCameraEnabled(false);
      setIsLooking(false);
      setDetectedMood('neutral');
    } else {
      initVisionAndCamera();
    }
  };

  return (
    <AttentionContext.Provider value={{
      isLooking,
      detectedMood,
      cameraEnabled,
      isLoading,
      toggleCamera,
      isLoaded,
      videoRef,
      canvasRef,
      getActiveReadingTime: () => activeReadingTimeRef.current
    }}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline autoPlay></video>
      {children}
    </AttentionContext.Provider>
  );
}

export function CameraPreview() {
  const { videoRef, canvasRef, cameraEnabled, isLoading } = useAttention();

  if (!cameraEnabled && !isLoading) {
    return null;
  }

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', background: '#1c1c1e', aspectRatio: '4/3' }}>
      <video
        ref={videoRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        playsInline
        autoPlay
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', pointerEvents: 'none' }}
      />
      {isLoading && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
          ⏳ Loading AI Model...
        </div>
      )}
    </div>
  );
}
