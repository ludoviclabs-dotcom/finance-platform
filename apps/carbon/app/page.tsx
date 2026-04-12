"use client";

import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/pages/landing-page";

export default function Home() {
  const router = useRouter();
  return <LandingPage onEnterApp={() => router.push("/login")} />;
}
