"use client";

/** Bouton d'impression isolé en client component pour garder le reste du guide en RSC. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer"
    >
      Imprimer / PDF
    </button>
  );
}
