import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article Studio",
  description: "Studio éditorial privé source-grounded — RAG × Claude API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
