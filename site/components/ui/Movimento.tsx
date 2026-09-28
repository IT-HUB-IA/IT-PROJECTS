"use client";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// respeita "reduzir movimento" do aparelho em todas as animações
export function Movimento({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
