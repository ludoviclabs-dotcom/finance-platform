export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-neural px-8 pb-16 pt-30 text-white md:px-12 lg:pt-36">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">Mentions légales</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/68">
          Cette page fournit un socle minimum de lisibilité pour le shell public actuel. Les
          informations légales détaillées seront enrichies a mesure que le packaging public de
          NEURAL sera finalisé.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Editeur</h2>
            <p className="mt-2">NEURAL AI Consulting SAS</p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Contact</h2>
            <p className="mt-2">ludoviclabs@gmail.com</p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Etat du site</h2>
            <p className="mt-2">
              Le site distingue explicitement ce qui est live, démo orchestrée ou en préparation.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
