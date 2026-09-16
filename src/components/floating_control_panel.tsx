import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { TUXIconNowSetting } from "@byted-tiktok/tux-icons";

const DEFAULT_CANVAS_HEIGHT = 844;
const HANDLE_WIDTH = 28;
const HANDLE_HEIGHT = 52;
const HANDLE_INITIAL_TOP = 254;
const HANDLE_TOP_MIN = 96;
const HANDLE_BOTTOM_INSET = 16;
const PANEL_GAP = 8;

type FloatingPanelLayout = {
  handleTop: number;
  panelDragHandleProps: {
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  };
  panelRight: number;
  panelTop: number;
};

type FloatingControlPanelProps = {
  ariaLabel: string;
  children?: (layout: FloatingPanelLayout) => ReactNode;
  canvasHeight?: number;
  contextId?: string;
  hidden?: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function FloatingControlPanel({
  ariaLabel,
  children,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  contextId,
  hidden = false,
  isOpen,
  onOpenChange,
}: FloatingControlPanelProps) {
  const [handleTop, setHandleTop] = useState(HANDLE_INITIAL_TOP);
  const [panelRight, setPanelRight] = useState(HANDLE_WIDTH + PANEL_GAP);
  const [panelTop, setPanelTop] = useState(HANDLE_INITIAL_TOP);
  const handleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientY: number;
    startTop: number;
    canvasScale: number;
    moved: boolean;
  } | null>(null);
  const panelDragStateRef = useRef<{
    canvasScaleX: number;
    canvasScaleY: number;
    panelHeight: number;
    panelWidth: number;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startRight: number;
    startTop: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        handleRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        handleOutsidePointerDown,
        true,
      );
  }, [isOpen, onOpenChange]);

  const clampHandleTop = (top: number) =>
    Math.min(
      canvasHeight - HANDLE_BOTTOM_INSET - HANDLE_HEIGHT,
      Math.max(HANDLE_TOP_MIN, top),
    );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const canvas = event.currentTarget.parentElement;
    const canvasScale = canvas
      ? canvas.getBoundingClientRect().height / canvasHeight
      : 1;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      startTop: handleTop,
      canvasScale: Math.max(canvasScale, 0.01),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY =
      (event.clientY - dragState.startClientY) / dragState.canvasScale;
    if (Math.abs(deltaY) >= 4) {
      dragState.moved = true;
    }
    if (dragState.moved) {
      const nextTop = clampHandleTop(dragState.startTop + deltaY);
      setHandleTop(nextTop);
      if (isOpen) {
        setPanelTop(nextTop);
      }
    }
  };

  const releaseDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    suppressNextClick: boolean,
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStateRef.current = null;
    if (dragState.moved) {
      suppressClickRef.current = suppressNextClick;
    }
  };

  const handlePanelPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const canvas = panelRef.current;
    const panel = event.currentTarget.closest<HTMLElement>(
      "[data-floating-control-surface]",
    );
    if (!canvas || !panel) {
      return;
    }

    const canvasBounds = canvas.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const canvasScaleX =
      canvasBounds.width / Math.max(canvas.clientWidth, 1);
    const canvasScaleY =
      canvasBounds.height / Math.max(canvas.clientHeight, 1);
    panelDragStateRef.current = {
      canvasScaleX: Math.max(canvasScaleX, 0.01),
      canvasScaleY: Math.max(canvasScaleY, 0.01),
      panelHeight: panelBounds.height / Math.max(canvasScaleY, 0.01),
      panelWidth: panelBounds.width / Math.max(canvasScaleX, 0.01),
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRight: panelRight,
      startTop: panelTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanelPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const dragState = panelDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const canvasWidth = panelRef.current?.clientWidth ?? 390;
    const canvasLogicalHeight =
      panelRef.current?.clientHeight ?? canvasHeight;
    const deltaX =
      (event.clientX - dragState.startClientX) / dragState.canvasScaleX;
    const deltaY =
      (event.clientY - dragState.startClientY) / dragState.canvasScaleY;
    const maxRight = Math.max(
      PANEL_GAP,
      canvasWidth - dragState.panelWidth - PANEL_GAP,
    );
    const maxTop = Math.max(
      HANDLE_BOTTOM_INSET,
      canvasLogicalHeight -
        dragState.panelHeight -
        HANDLE_BOTTOM_INSET,
    );

    setPanelRight(
      Math.min(
        maxRight,
        Math.max(PANEL_GAP, dragState.startRight - deltaX),
      ),
    );
    setPanelTop(
      Math.min(
        maxTop,
        Math.max(HANDLE_BOTTOM_INSET, dragState.startTop + deltaY),
      ),
    );
  };

  const releasePanelDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const dragState = panelDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panelDragStateRef.current = null;
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[110]"
      data-floating-control={contextId}
      style={{ display: hidden ? "none" : undefined }}
    >
      {isOpen ? (
        <div
          ref={panelRef}
          className="pointer-events-none absolute inset-0"
          data-floating-control-panel-region
        >
          {children?.({
            handleTop,
            panelDragHandleProps: {
              onPointerCancel: releasePanelDrag,
              onPointerDown: handlePanelPointerDown,
              onPointerMove: handlePanelPointerMove,
              onPointerUp: releasePanelDrag,
            },
            panelRight,
            panelTop,
          })}
        </div>
      ) : null}
      <button
        ref={handleRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "收起" : "打开"}${ariaLabel}`}
        className={`pointer-events-auto absolute right-0 flex h-[52px] w-[28px] origin-right cursor-ns-resize touch-none select-none items-center justify-center border border-r-0 border-[rgba(255,255,255,0.18)] text-[rgba(255,255,255,0.94)] shadow-[var(--tux-v2-shadow-attached,0_2px_10px_rgba(0,0,0,0.21))] backdrop-blur-[14px] transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white/80 ${
          isOpen
            ? "bg-[rgba(255,255,255,0.28)]"
            : "bg-[rgba(255,255,255,0.18)]"
        }`}
        data-floating-control-handle
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (!isOpen) {
            setPanelRight(HANDLE_WIDTH + PANEL_GAP);
            setPanelTop(handleTop);
          }
          onOpenChange(!isOpen);
        }}
        onPointerCancel={(event) => releaseDrag(event, false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => releaseDrag(event, true)}
        style={{
          top: handleTop,
          borderRadius:
            "var(--tux-v2-radius-container-level1-small, 10px) 0 0 var(--tux-v2-radius-container-level1-small, 10px)",
        }}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-[3px] top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-full transition-colors duration-150 ${
            isOpen ? "bg-white/85" : "bg-white/55"
          }`}
        />
        <span className="ml-[2px] flex" aria-hidden="true">
          <TUXIconNowSetting size={16} />
        </span>
      </button>
    </div>
  );
}
