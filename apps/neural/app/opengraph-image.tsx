import { ImageResponse } from "next/og";

export const alt = "NEURAL — Intelligence Augmentee pour l'Entreprise";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
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
          NEURAL
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a0a0b0",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          Intelligence Augmentee pour l'Entreprise
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#6366f1",
            marginTop: "30px",
          }}
        >
          Claude AI - 7 branches metier - ROI mesure
        </div>
      </div>
    ),
    { ...size },
  );
}
