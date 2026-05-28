/**
 * JsonLd — composant server qui rend un script JSON-LD pour les Rich Results Google.
 *
 * Sans `dangerouslySetInnerHTML`, Next.js sérialiserait le JSON avec des entités
 * HTML (par ex. `&quot;`) qui rendraient le schema invalide pour Googlebot. On
 * passe donc explicitement par `JSON.stringify` + dangerouslySetInnerHTML, en
 * acceptant uniquement des objets typés (pas de string brute) pour éliminer le
 * risque d'injection.
 *
 * Usage type :
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} />
 *
 * Référence : https://developers.google.com/search/docs/appearance/structured-data
 */

export interface JsonLdData {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

interface JsonLdProps {
  data: JsonLdData;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // Sérialisation côté serveur — le résultat est immutable côté client.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
