"use client";

import { useCallback, useEffect, useRef } from "react";

/** 최대 기울기 — 이 이상은 장식이 아니라 방해다. */
const MAX_TILT_DEG = 5;

/**
 * 3D 틸트 래퍼 — 포인터 위치를 따라 카드가 미세하게 기울어진다(web3 리뉴얼 v2).
 *
 * globals.css의 .tilt-3d가 --tilt-x/--tilt-y 변수를 소비한다. rAF로 스로틀해
 * pointermove당 스타일 쓰기를 프레임당 1회로 제한(INP 예산 보호). 터치 기기는
 * hover가 없어 leave에서 원복되고, reduced-motion에선 CSS가 transform 자체를
 * 무효화하므로 JS를 따로 분기하지 않는다.
 */
export function TiltCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const frameRef = useRef(0);

  // 언마운트 시 대기 중인 프레임 취소 — hover 중 리스트 필터링으로 카드가
  // 사라져도 분리된 노드에 스타일을 쓰는 잔여 콜백이 남지 않게 한다.
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const handleMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      el.style.setProperty("--tilt-x", `${(-py * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * MAX_TILT_DEG * 2).toFixed(2)}deg`);
    });
  }, []);

  const handleLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    cancelAnimationFrame(frameRef.current);
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <div
      className={`tilt-3d ${className ?? ""}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </div>
  );
}
