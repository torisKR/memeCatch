import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // flame 글로우는 hover 전용(box-shadow arbitrary) — .hover-glow-flame(unlayered)을 그대로 합성하면
        // focus-visible:ring의 box-shadow를 레이어 우선순위로 덮어써 포커스 링이 사라짐. hover에만 스코프.
        default:
          "bg-foreground text-background hover:bg-foreground/90 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)]",
        secondary:
          "bg-accent-soft text-accent-text hover:bg-accent-soft/80 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)]",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-2",
        ghost: "text-foreground hover:bg-surface-2",
        link: "text-accent-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        // sm은 32px로 44px 터치 최소 기준 미만 — 호출부에서 hit-slop(before:-inset-*) 적용 필요
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
