export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-neural px-8 pb-16 pt-30 text-white md:px-12 lg:pt-36">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">Confidentialite</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/68">
          Cette page expose le niveau d&apos;information disponible aujourd&apos;hui sans pretendre a une
          politique plus complete qu&apos;elle ne l&apos;est.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Prise de contact</h2>
            <p className="mt-2">
              Le formulaire de contact ouvre un email pre-rempli et n&apos;installe pas de back-office
              supplementaire dans cette incremention.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Donnees de demonstration</h2>
            <p className="mt-2">
              Les pages publiques distinguent explicitement les surfaces live, les demos orchestrees
              et les pages en preparation.
            </p>
          </section>
          <section>
            <h2 className="font-display text-2xl font-bold text-white">Contact</h2>
            <p className="mt-2">Pour toute question, ecrire a ludoviclabs@gmail.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
