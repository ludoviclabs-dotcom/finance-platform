import { ImageResponse } from "next/og";

export const alt = "CarbonCo — Plateforme de pilotage ESG & CSRD";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #0d1f17 50%, #132a1c 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: "20px",
          }}
        >
          CarbonCo
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a0b0a0",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          Plateforme de pilotage ESG & CSRD augmentee par l'IA
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#10b981",
            marginTop: "30px",
          }}
        >
          ESRS E1 - Scope 1 2 3 - Infrastructure EU
        </div>
      </div>
    ),
    { ...size },
  );
}
