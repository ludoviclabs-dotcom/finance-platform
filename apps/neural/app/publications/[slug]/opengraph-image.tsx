import { readPublicationFrontmatter } from "@/lib/publications-frontmatter";
import { OG_CONTENT_TYPE, OG_SIZE, renderNeuralOg } from "@/lib/og-image";

export const alt = "Publication NEURAL";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const publication = await readPublicationFrontmatter(slug);

  if (!publication) {
    return renderNeuralOg({
      eyebrow: "Publications · NEURAL Labs",
      title: "Article NEURAL",
      subtitle: "Une lecture pensée pour clarifier les décisions IA en entreprise.",
      variant: "cream",
    });
  }

  return renderNeuralOg({
    eyebrow: `${publication.category} · ${publication.audience}`,
    title: publication.title,
    subtitle: publication.subtitle,
    badge: `${publication.readingTime} · ${publication.displayMonth}`,
    variant: "cream",
  });
}
