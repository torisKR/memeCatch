"use client";

import { Children, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

/**
 * 스태거 진입 래퍼 (DESIGN.md §5: 카드 진입 opacity0→1, y12→0, 스태거 40ms).
 * 자식 하나하나를 뷰포트 진입 시 순차 페이드시킨다(once). reduced-motion 존중.
 *
 * 사용 예 (홈/검색 그리드):
 *   <MotionList as="ul" itemAs="li"
 *     className="grid grid-cols-2 gap-4 sm:grid-cols-3" itemClassName="min-w-0">
 *     {memes.map((m) => <MemeCard key={m.id} meme={m} />)}
 *   </MotionList>
 *
 * 각 자식을 itemAs 요소로 감싸므로, 자식은 리스트 래퍼(li) 없이 넘긴다.
 */

const CONTAINERS = { div: motion.div, ul: motion.ul, section: motion.section } as const;
const ITEMS = { div: motion.div, li: motion.li } as const;

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function MotionList({
  children,
  className,
  itemClassName,
  as = "div",
  itemAs = "div",
  staggerDelay = 0.04,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  as?: keyof typeof CONTAINERS;
  itemAs?: keyof typeof ITEMS;
  staggerDelay?: number;
}) {
  const reduce = useReducedMotion();

  // reduced-motion: 애니메이션 없이 동일한 DOM 구조만 유지
  if (reduce) {
    const StaticContainer = as;
    const StaticItem = itemAs;
    return (
      <StaticContainer className={className}>
        {Children.map(children, (child) => (
          <StaticItem className={itemClassName}>{child}</StaticItem>
        ))}
      </StaticContainer>
    );
  }

  const Container = CONTAINERS[as];
  const Item = ITEMS[itemAs];

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: staggerDelay, delayChildren: 0.02 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  };

  return (
    <Container
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
    >
      {Children.map(children, (child) => (
        <Item className={itemClassName} variants={item}>
          {child}
        </Item>
      ))}
    </Container>
  );
}
