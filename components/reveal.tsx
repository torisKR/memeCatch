"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * 스크롤 리빌 래퍼 (DESIGN.md §5: opacity+y 350ms, 뷰포트 진입 once).
 * 섹션·블록을 감싸 스크롤 진입 시 한 번 페이드-업. reduced-motion 존중.
 *
 * 사용 예: <Reveal as="section" delay={0.05}>…</Reveal>
 */

const TAGS = { div: motion.div, section: motion.section, ul: motion.ul, li: motion.li } as const;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  className,
  as = "div",
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  as?: keyof typeof TAGS;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    const Static = as;
    return <Static className={className}>{children}</Static>;
  }

  const Comp = TAGS[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.35, ease: EASE_OUT, delay }}
    >
      {children}
    </Comp>
  );
}
