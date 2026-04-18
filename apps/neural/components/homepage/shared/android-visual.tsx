import Image from "next/image";

interface AndroidVisualProps {
  size?: number;
  glow?: boolean;
  className?: string;
}

export function AndroidVisual({ size = 560, glow = true, className = "" }: AndroidVisualProps) {
  return (
    <div className={`nhp-android ${className}`} style={{ width: size, maxWidth: "100%" }}>
      {glow && <div className="nhp-android-halo" />}
      <Image
        src="/images/neural-android.png"
        alt="NEURAL android"
        width={size}
        height={Math.round(size * 1.2)}
        className="nhp-android-img"
        priority
      />
    </div>
  );
}
