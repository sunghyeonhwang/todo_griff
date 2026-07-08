import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MOTION } from '../lib/tokens';

// 범용 바텀시트 크롬 — DESIGN.md §5
// - viewport 하단 고정, max-w-app, 상단 라운드 --radius-xl, 백드롭 --surface-overlay,
//   슬라이드업 --duration-slow + --ease-decelerate(CSS transition — 애니메이션 라이브러리 없음),
//   36×5px 그래버, max-height 85dvh 내부 스크롤, role="dialog" aria-modal, z-modal(50).
// - 닫힘 경로 3종: Escape / 백드롭 탭 / 그래버 80px 하향 드래그.
// - 포커스 트랩: Tab 순환. 열릴 때 자식 autoFocus(§5 create 제목) 우선, 없으면 시트 자체.
//   닫히면 이전 포커스 복원.
// - iOS 키보드: dvh는 온스크린 키보드를 추적하지 않음 → 열림 동안 visualViewport
//   resize/scroll로 시트 bottom을 직접 오프셋(스타일 변이 — 리렌더 없음).

const SHEET_CLOSE_DRAG_PX = 80; // 그래버 하향 드래그 닫힘 임계(§5)

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** role="dialog"의 aria-label */
  label: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // 마운트/표시 2단계 — 슬라이드업(off-screen 첫 페인트 후 transition)과
  // 슬라이드다운(transition 종료 후 언마운트)을 CSS transition만으로 처리.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), MOTION.duration.slow);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open, mounted]);

  // 포커스 트랩 + Escape (§5)
  useEffect(() => {
    if (!open || !mounted) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 자식 autoFocus가 이미 포커스를 가져갔다면 존중, 아니면 시트 자체로(키보드 강제 오픈 없음)
    if (!sheet.contains(document.activeElement)) sheet.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocus?.focus();
    };
  }, [open, mounted]);

  // visualViewport 키보드 대응(§5) — bottom = innerHeight - vv.height - vv.offsetTop
  useEffect(() => {
    if (!open || !mounted) return;
    const vv = window.visualViewport;
    const sheet = sheetRef.current;
    if (!vv || !sheet) return;
    const update = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      sheet.style.bottom = `${gap}px`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      sheet.style.bottom = '';
    };
  }, [open, mounted]);

  // 그래버 80px 하향 드래그 → 닫힘(§5). 시각 팔로우 없음 — 임계 도달 즉시 닫는다.
  const dragStartY = useRef<number | null>(null);
  const onGrabberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGrabberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    if (e.clientY - dragStartY.current >= SHEET_CLOSE_DRAG_PX) {
      dragStartY.current = null;
      onClose();
    }
  };
  const endGrabberDrag = () => {
    dragStartY.current = null;
  };

  if (!mounted) return null;

  return (
    <div className={`fixed inset-0 z-(--z-modal) ${shown ? '' : 'pointer-events-none'}`}>
      {/* 백드롭 — 탭으로 닫힘 */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-surface-overlay transition-opacity duration-(--duration-slow) ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-app flex-col rounded-t-xl bg-surface-card shadow-lg outline-none transition-transform duration-(--duration-slow) ease-(--ease-decelerate) ${
          shown ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* 그래버 36×5px(§5) */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center py-2"
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={endGrabberDrag}
          onPointerCancel={endGrabberDrag}
        >
          <div aria-hidden className="h-[5px] w-9 rounded-full bg-surface-timeline-line" />
        </div>
        {/* 내부 스크롤 + 하단 safe-area 패딩(§6.5) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
