const testimonials = [
  {
    quote:
      "NEURAL a déployé 3 agents en comptabilité qui nous font gagner 120h/mois. Le ROI était visible dès la semaine 3.",
    author: "Marie D.",
    role: "DAF",
    company: "Groupe Transport Île-de-France",
  },
  {
    quote:
      "L'approche structurée de NEURAL est ce qui manquait à nos précédentes tentatives. Enfin des agents IA que nos équipes utilisent vraiment.",
    author: "Thomas L.",
    role: "DSI",
    company: "Maison de luxe parisienne",
  },
  {
    quote:
      "Le simulateur de prix nous a permis de budgéter précisément notre transformation IA. Zéro mauvaise surprise.",
    author: "Sophie R.",
    role: "Directrice Innovation",
    company: "Néo-banque B2B",
  },
];

export function Testimonials() {
  return (
    <section className="bg-surface-raised py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-4xl font-bold">
          Ils nous font confiance
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.author} className="card p-6">
              <p className="text-sm italic text-foreground-muted leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6">
                <p className="font-semibold">{t.author}</p>
                <p className="text-xs text-foreground-subtle">
                  {t.role}, {t.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
