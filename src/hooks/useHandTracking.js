import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Sets up the webcam and a MediaPipe HandLandmarker, then runs a
// requestAnimationFrame detection loop. Frame results are pushed straight
// into onResults (a ref, not React state) so the hot path never triggers a
// re-render — the caller decides what, if anything, becomes UI state.
export function useHandTracking(onResults) {
  const videoRef = useRef(null);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [stage, setStage] = useState('model'); // model | camera (only meaningful while status is loading)
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let landmarker = null;
    let stream = null;
    let rafId = null;

    async function setup() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        if (cancelled) return;
        setStage('camera');

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        if (cancelled) return;
        setStatus('ready');

        const loop = () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            const result = landmarker.detectForVideo(video, performance.now());
            onResultsRef.current?.(result, video);
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        console.error('Hand tracking setup failed', err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, status, stage, error };
}
