import Link from "next/link";

const legalSections = [
  {
    title: "Beach access and public use",
    body:
      "Puerto Rico coastal law treats the beach and the maritime-terrestrial zone as public domain. In practical terms, that means shoreline access disputes are not read only as private-property conflicts. Public use and public passage are part of the legal framework."
  },
  {
    title: "Maritime-terrestrial zone",
    body:
      "Law No. 151 of 1968 is one of the core references behind Puerto Rico's coastal management framework. It provides the legal basis for protecting beaches and the maritime-terrestrial zone and is part of the background for how the public coastal strip is administered."
  },
  {
    title: "Permits and coastal oversight",
    body:
      "Law No. 23 of 1972 created the Department of Natural and Environmental Resources and assigned it authority over natural resources, including coastal and submerged public-domain areas. Coastal works, access barriers, and shoreline interventions may therefore raise permitting and agency-review questions."
  },
  {
    title: "Protected dunes, mangroves, reefs, and other sensitive systems",
    body:
      "Puerto Rico's Coastal Zone Management Program states that activities that may deteriorate or destroy critical natural systems should be avoided. The policy specifically points to areas such as mangroves, reefs, dunes, and habitats important to protected species."
  }
];

const legalSources = [
  {
    title: "Ley Núm. 151 de 1968",
    detail: "Beach and maritime-terrestrial zone protection framework",
    url: "https://www.drna.pr.gov/avisos/sistema-de-referencia-oficial-para-el-deslinde-de-bienes-de-dominio-publico-maritimo-terrestre/"
  },
  {
    title: "Ley Núm. 23 de 1972",
    detail: "Creates the environmental agency with coastal oversight powers",
    url: "https://www.drna.pr.gov/biblioteca/leyes-y-reglamentos/leyes/"
  },
  {
    title: "Reglamento 4860",
    detail: "Use, surveillance, conservation, and administration of territorial waters, submerged lands, and the maritime-terrestrial zone",
    url: "https://www.drna.pr.gov/documentos/reglamento-4860/"
  },
  {
    title: "Programa de Manejo de la Zona Costanera",
    detail: "Policy framework including protection of dunes, mangroves, reefs, and other critical systems",
    url: "https://www.drna.pr.gov/oficinas/division-de-bienes-de-dominio-publico-maritimo-terrestre-2/"
  }
];

export default function LegalFrameworkPage() {
  return (
    <main className="page-shell legal-page-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Link className="detail-back-link" href="/">
          Back to map
        </Link>

        <section className="legal-page-hero">
          <div className="legal-page-hero-main">
            <p className="legal-page-kicker">Legal framework</p>
            <h1 className="legal-page-title">Key Puerto Rico laws behind beach access and coastal cases.</h1>
            <p className="legal-page-copy">
              This page summarizes the main legal authorities that shape coastal access disputes,
              shoreline permitting questions, and cases involving dunes, mangroves, reefs, and
              other sensitive areas. It is a public reference page, not legal advice.
            </p>
          </div>

          <aside className="legal-page-aside">
            <p className="legal-page-aside-heading">What you will find here</p>
            <ul className="legal-page-list">
              <li>the public-domain basis for beach access</li>
              <li>the legal role of the maritime-terrestrial zone</li>
              <li>how permits and agency oversight affect shoreline disputes</li>
              <li>why protected coastal systems matter in case review</li>
            </ul>
          </aside>
        </section>

        <section className="legal-page-framework">
          <div className="legal-page-section-head">
            <p className="legal-page-section-kicker">Core laws and rules</p>
            <p className="legal-page-section-copy">
              These are the legal foundations most relevant to the kinds of cases Coastal Watch
              tracks on the public map.
            </p>
          </div>

          <div className="legal-page-grid">
            {legalSections.map((section) => (
              <article className="legal-page-card" key={section.title}>
                <h2 className="legal-page-card-title">{section.title}</h2>
                <p className="legal-page-card-copy">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="legal-page-framework">
          <div className="legal-page-section-head">
            <p className="legal-page-section-kicker">Key source material</p>
            <p className="legal-page-section-copy">
              These links point to the official Puerto Rico environmental and coastal-management
              materials used to frame this reference page.
            </p>
          </div>

          <div className="legal-page-rule-list">
            {legalSources.map((source) => (
              <a
                className="legal-page-rule legal-page-source"
                href={source.url}
                key={source.title}
                rel="noreferrer"
                target="_blank"
              >
                <p className="legal-page-source-title">{source.title}</p>
                <p className="legal-page-source-detail">{source.detail}</p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
