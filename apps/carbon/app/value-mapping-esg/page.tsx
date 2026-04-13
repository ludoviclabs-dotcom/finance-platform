"use client";

import { useRouter } from "next/navigation";
import { ValueMappingEsgLanding } from "@/components/pages/value-mapping-esg-landing";

export default function ValueMappingEsgPage() {
  const router = useRouter();
  return (
    <ValueMappingEsgLanding
      onCta={() => router.push("/login?redirect=/insights/adhesion-volontaire")}
    />
  );
}
