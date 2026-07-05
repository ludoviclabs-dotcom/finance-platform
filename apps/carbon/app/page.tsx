import { getMaterials } from "@/lib/crm/dataLoader";
import { HomeClient } from "@/components/pages/home-client";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Homepage — composant serveur : charge le snapshot Matières critiques au
 * build (JSON local, aucune API runtime) et ne passe au client que les
 * chiffres affichés dans la bande module. Le rendu interactif vit dans
 * components/pages/home-client.tsx.
 */
export default async function Home() {
  const { materials, total_materials, strategic_count, snapshot_date } = await getMaterials();
  const chinaDominant = materials.filter((m) => m.china_dominant).length;
  const [y, mo, d] = snapshot_date.split("-").map(Number);
  const snapshotLabel = `${d} ${MOIS[mo - 1]} ${y}`;

  return (
    <HomeClient
      materialsStats={{
        total: total_materials,
        strategic: strategic_count,
        chinaDominant,
        snapshotLabel,
      }}
    />
  );
}
