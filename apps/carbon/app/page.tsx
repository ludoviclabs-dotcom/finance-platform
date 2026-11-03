import { getMaterials } from "@/lib/crm/dataLoader";
import { ESRS_SET2 } from "@/lib/esrs/schema";
import { HomePage } from "@/components/accueil/HomePage";
import { HomeShell } from "@/components/accueil/HomeShell";

/**
 * Homepage — composant serveur : lit au build le nombre de points de donnée
 * du référentiel ESRS et le nombre de matières du snapshot /materials (JSON
 * local, aucune API runtime). Seuls ces deux nombres sont rendus ; la page
 * elle-même est components/accueil/HomePage.tsx.
 */
export default async function Home() {
  const { total_materials } = await getMaterials();
  return (
    <HomeShell>
      <HomePage esrsDatapointCount={ESRS_SET2.datapoints.length} materialsTotal={total_materials} />
    </HomeShell>
  );
}
