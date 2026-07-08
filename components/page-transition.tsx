"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * 라우트 전환 진입 애니메이션 — fade + slight slide 300ms.
 * app/template.tsx가 세그먼트마다 고유 key로 리마운트하므로,
 * 여기서는 진입(initial→animate)만 담당한다(콘텐츠를 가리지 않게 y는 작게).
 * prefers-reduced-motion이면 애니메이션 없이 그대로 렌더한다.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
