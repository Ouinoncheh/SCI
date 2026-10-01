'use client';
import { PageHeading } from '@/ui/shell';
import { useDemo } from '@/ui/demo-context';
export default function Assumptions() {
  const { persistent } = useDemo();
  return (
    <>
      <PageHeading
        eyebrow="LA CONFIANCE PAR LA TRANSPARENCE"
        title="Chaque chiffre a une histoire."
        description="Les conventions, les sources et les limites de cette première version."
        action={false}
      />
      <div className="two-columns">
        <section className="panel prose">
          <h2>Ce qui est calculé</h2>
          <p>
            Le moteur version 0.1 calcule un prêt amortissable à taux fixe, les coûts d’acquisition,
            les charges, les rendements avant impôt, le cash-flow et des projections jusqu’à 25 ans.
          </p>
          <ul>
            <li>Les frais d’acquisition s’appliquent au prix d’achat.</li>
            <li>La marge travaux s’applique uniquement au budget travaux.</li>
            <li>L’emprunt couvre le coût total moins l’apport.</li>
            <li>L’assurance porte sur le capital initial et cesse à la fin du prêt.</li>
            <li>Vacance déduite avant gestion, GLI et provision travaux.</li>
            <li>Le rendement net exclut financement et fiscalité.</li>
            <li>Le DSCR inclut l’assurance dans le service de la dette.</li>
            <li>Une division par un apport ou une dette nuls donne un indicateur indisponible.</li>
          </ul>
          <h3>Projection et cession</h3>
          <p>
            La valeur de départ est le prix d’achat, sans plus-value automatique liée aux travaux.
            Les frais de vente sont déduits, mais la fiscalité de cession et les pénalités de
            remboursement anticipé ne sont pas modélisées.
          </p>
          <p>
            Les provisions annuelles sont traitées comme des sorties prudentes de trésorerie. Les
            travaux futurs s’y ajoutent : aucune réserve de trésorerie disponible n’est
            comptabilisée. Le gain total n’est ni un TRI ni un taux annualisé.
          </p>
        </section>
        <section className="panel prose">
          <h2>Ce qui est fictif ou indisponible</h2>
          <p>
            {persistent
              ? 'Les caractéristiques des biens et les hypothèses sont renseignées par votre SCI ; elles ne sont pas vérifiées auprès de sources externes.'
              : 'Les quatre biens initiaux, leurs loyers, leurs charges, leurs DPE, la SCI et ses membres sont entièrement fictifs.'}{' '}
            Les illustrations représentent des immeubles imaginaires.
          </p>
          <p>
            Les scénarios prudent, central et optimiste sont des exemples, pas des prévisions de
            marché. Leur croissance et leurs frais sont modifiables dans la page d’analyse.
          </p>
          <div className="source-list">
            <div>
              <strong>Prix de marché · DVF</strong>
              <span>Non connecté</span>
            </div>
            <div>
              <strong>Démographie · INSEE</strong>
              <span>Non connecté</span>
            </div>
            <div>
              <strong>Loyers de marché</strong>
              <span>Donnée indisponible</span>
            </div>
            <div>
              <strong>Fiscalité IR / IS</strong>
              <span>Non implémentée</span>
            </div>
            <div>
              <strong>Liquidité / copropriété</strong>
              <span>Donnée indisponible</span>
            </div>
          </div>
          <h3>Score d’opportunité partiel</h3>
          <p>
            Seuls les critères renseignés entrent dans la moyenne pondérée. Le pourcentage de
            couverture indique la part des pondérations documentées. Une bonne note avec peu de
            couverture ne suffit pas à valider un investissement.
          </p>
        </section>
      </div>
      <section className="panel prose">
        <h2>
          {persistent ? 'Votre espace enregistré et partagé' : 'Démonstration et espace connecté'}
        </h2>
        <p>
          {persistent
            ? 'Les biens, favoris, statuts et analyses de votre SCI sont enregistrés. Le comparateur reprend les dernières hypothèses sauvegardées. Chaque enregistrement conserve une analyse consultable dans l’historique.'
            : 'Les favoris, statuts et nouveaux biens de la démonstration sont effacés au rechargement. Les simulations restent temporaires. Connectez-vous pour créer une SCI et enregistrer vos analyses.'}
        </p>
        <p>
          Dans l’espace connecté, les administrateurs et membres peuvent commenter et voter. Les
          lecteurs peuvent consulter les échanges. Les mentions envoient une notification dans
          l’application aux seuls membres concernés. Les votes ne modifient jamais les calculs
          financiers. Actualisez les échanges pour voir les nouvelles contributions.
        </p>
        <h3>Import et sources externes</h3>
        <p>
          L’import actuel extrait uniquement un prix et une surface du texte fourni. Il ne visite
          aucune URL et ne contourne aucune protection. Les futurs connecteurs devront documenter
          leur autorisation d’accès et conserver source, date, zone et confiance pour chaque
          observation.
        </p>
      </section>
    </>
  );
}
