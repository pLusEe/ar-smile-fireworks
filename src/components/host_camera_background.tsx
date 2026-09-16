import { TUXButton, TUXText } from "@byted-tiktok/tux-web";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

type CameraStatus = "requesting" | "active" | "unavailable";

type HostCameraBackgroundProps = {
  videoRef?: RefObject<HTMLVideoElement>;
};

export function HostCameraBackground({
  videoRef: externalVideoRef,
}: HostCameraBackgroundProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const streamRef = useRef<MediaStream | null>(null);
  const requestIdRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("requesting");

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setStatus("requesting");
    const requestId = requestIdRef.current;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera capture is unavailable");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          height: { ideal: 1280 },
          width: { ideal: 720 },
        },
      });

      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("active");
    } catch {
      if (requestId === requestIdRef.current) {
        setStatus("unavailable");
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        aria-label="主播摄像头实时画面"
        autoPlay
        className={`h-full w-full scale-x-[-1] object-cover transition-opacity duration-200 ${
          status === "active" ? "opacity-100" : "opacity-0"
        }`}
        muted
        playsInline
      />

      {status !== "active" ? (
        <div
          aria-live="polite"
          className={`absolute inset-0 flex justify-center bg-[var(--tux-v2-color-ui-page-flat-1)] px-[32px] ${
            status === "requesting" ? "items-start pt-[172px]" : "items-center"
          }`}
        >
          {status === "requesting" ? (
            <TUXText
              color="UIText2"
              typographyPreset="P1-Regular"
            >
              正在连接摄像头…
            </TUXText>
          ) : (
            <div className="flex w-full max-w-[260px] flex-col items-center gap-[12px] text-center">
              <div className="flex flex-col gap-[4px]">
                <TUXText
                  color="UIText1"
                  typographyPreset="Headline-Semibold"
                >
                  无法访问摄像头
                </TUXText>
                <TUXText
                  color="UIText2"
                  typographyPreset="P2-Regular"
                >
                  请允许摄像头权限后重试
                </TUXText>
              </div>
              <TUXButton
                onClick={() => void startCamera()}
                shapePreset="normal"
                sizePreset="small"
                smoothRadius
                text="重新连接"
                themePreset="secondary"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
