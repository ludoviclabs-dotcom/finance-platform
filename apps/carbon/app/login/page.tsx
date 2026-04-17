"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/pages/login-screen";
import { useAuth } from "@/lib/hooks/use-auth";

export default function LoginPage() {
  const { auth, ready, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && auth.status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [ready, auth.status, router]);

  if (!ready) return null;

  return (
    <LoginScreen
      onLogin={async (email, password) => {
        const result = await login(email, password);
        if (result.ok) router.replace("/dashboard");
        return result;
      }}
      onDemo={async () => {
        const result = await login("demo@carbonco.fr", "CarbonCo2024!");
        if (result.ok) router.replace("/dashboard");
        // Les identifiants démo existent dès que l'API a seedé les users (premier login).
        // Si l'erreur persiste, voir /login — les identifiants sont créés automatiquement.
      }}
    />
  );
}
