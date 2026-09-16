"use client";

import { getAuthToken } from "@/lib/api";

/**
 * Ouvre une pièce source du store privé dans un nouvel onglet, via la route
 * authentifiée /api/blob/source. L'onglet est ouvert AVANT la requête (geste
 * utilisateur, sinon bloqué par le navigateur), puis reçoit le document.
 */
export async function openTenantDocument(ref: string): Promise<void> {
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/blob/source?ref=${encodeURIComponent(ref)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Document indisponible.");
    }
    const url = URL.createObjectURL(await res.blob());
    if (tab) {
      tab.location.href = url;
    } else {
      // Onglet bloqué par le navigateur : téléchargement, sans quitter l'application.
      const link = document.createElement("a");
      link.href = url;
      link.download = ref.split("/").pop() || "document";
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    window.alert(err instanceof Error ? err.message : "Document indisponible.");
  }
}
