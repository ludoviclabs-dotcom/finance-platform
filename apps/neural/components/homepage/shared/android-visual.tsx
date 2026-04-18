import type { ReactNode } from "react";
import { AndroidSvg } from "./android-svg";

interface AndroidVisualProps {
  size?: number;
  glow?: boolean;
  className?: string;
  children?: ReactNode;
}

export function AndroidVisual({ size = 560, glow = true, className = "", children }: AndroidVisualProps) {
  return (
    <div
      className={`nhp-android ${className}`}
      style={{ width: size, maxWidth: "100%" }}
    >
      {glow && <div className="nhp-android-halo" />}
      <AndroidSvg className="nhp-android-img" />
      {children}
    </div>
  );
}
