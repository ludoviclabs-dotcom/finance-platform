/**
 * DemoDisclaimer — mention « données fictives » sous chaque bloc de démonstration
 * (T0.5 du PLAN_ACTION_CARBONCO). Le jeu unique vit dans data/demo-dataset.json
 * (entreprise fictive « Exemplia Industrie »).
 */

export function DemoDisclaimer({ note }: { note?: string }) {
  return (
    <p className="mt-4 text-center text-xs text-neutral-400">
      {note ??
        "Données fictives à but de démonstration — l'entreprise « Exemplia Industrie » n'existe pas."}
    </p>
  );
}
