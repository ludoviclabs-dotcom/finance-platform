import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

export type OgImageProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  variant?: "midnight" | "cream";
};

const PALETTE = {
  midnight: "#0A1628",
  navy: "#111D35",
  violet: "#7C3AED",
  violetLight: "#A78BFA",
  green: "#10B981",
  cream: "#FAF8F5",
  ink55: "rgba(10,22,40,0.55)",
  ink65: "rgba(10,22,40,0.65)",
  white55: "rgba(255,255,255,0.55)",
  white70: "rgba(255,255,255,0.7)",
};

export function renderNeuralOg({
  eyebrow,
  title,
  subtitle,
  badge,
  variant = "midnight",
}: OgImageProps): ImageResponse {
  const isDark = variant === "midnight";
  const bgGradient = isDark
    ? `radial-gradient(ellipse at 75% 30%, rgba(124,58,237,0.32), transparent 55%), linear-gradient(180deg, ${PALETTE.navy} 0%, ${PALETTE.midnight} 100%)`
    : `radial-gradient(circle at 18% 22%, rgba(124,58,237,0.10) 0%, transparent 42%), radial-gradient(circle at 82% 78%, rgba(16,185,129,0.06) 0%, transparent 50%), ${PALETTE.cream}`;
  const textColor = isDark ? "#fff" : PALETTE.midnight;
  const subtleColor = isDark ? PALETTE.white70 : PALETTE.ink65;
  const eyebrowColor = isDark ? PALETTE.violetLight : PALETTE.violet;
  const eyebrowBorder = isDark ? "rgba(167,139,250,0.22)" : "rgba(124,58,237,0.20)";
  const eyebrowBg = isDark ? "rgba(167,139,250,0.08)" : "rgba(124,58,237,0.05)";
  const gridStroke = isDark ? "rgba(255,255,255,0.04)" : "rgba(10,22,40,0.04)";

  return new ImageResponse(
    (
      <div
        style={{
          background: bgGradient,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: textColor,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${gridStroke} 1px, transparent 1px), linear-gradient(90deg, ${gridStroke} 1px, transparent 1px)`,
            backgroundSize: "56px 56px",
            opacity: 0.6,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: PALETTE.violet,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
              boxShadow: "0 6px 16px -6px rgba(124,58,237,0.5)",
            }}
          >
            N
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "-0.02em",
              color: textColor,
            }}
          >
            NEURAL
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            position: "relative",
            marginTop: 16,
          }}
        >
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: 10,
                fontSize: 14,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 500,
                color: eyebrowColor,
                padding: "8px 16px",
                border: `1px solid ${eyebrowBorder}`,
                background: eyebrowBg,
                borderRadius: 999,
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: PALETTE.green,
                  display: "flex",
                }}
              />
              {eyebrow}
            </div>
          ) : null}

          <div
            style={{
              fontSize: title.length > 70 ? 56 : 68,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              color: textColor,
              maxWidth: "100%",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {title}
          </div>

          {subtitle ? (
            <div
              style={{
                marginTop: 28,
                fontSize: 26,
                lineHeight: 1.4,
                color: subtleColor,
                maxWidth: 920,
                display: "flex",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            marginTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 16,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: subtleColor,
              display: "flex",
            }}
          >
            neural-five.vercel.app
          </div>
          {badge ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(10,22,40,0.05)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,22,40,0.08)"}`,
                borderRadius: 999,
                fontSize: 15,
                fontWeight: 600,
                color: textColor,
              }}
            >
              {badge}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
