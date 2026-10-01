'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { investmentSchema, type Investment } from '@/financial-engine';
import { UserTextProvider } from '@/listing-providers';
import { useDemo } from '@/ui/demo-context';
import { InvestmentFields } from '@/ui/investment-fields';
import { RentEstimator } from '@/ui/rent-estimator';
import { PageHeading } from '@/ui/shell';
import { ListingImport } from '@/ui/listing-import';
import { ImportAnalysis } from '@/ui/import-analysis';
import type { ListingAttachment } from '@/listing-providers/import-types';
const empty: Investment = {
  price: NaN,
  area: NaN,
  acquisitionRate: 0,
  agencyFees: 0,
  works: 0,
  contingencyRate: 0,
  furniture: 0,
  bankFees: 0,
  guaranteeFees: 0,
  brokerFees: 0,
  otherFees: 0,
  contribution: 0,
  loanRate: 0,
  loanYears: 20,
  insuranceRate: 0,
  monthlyRent: NaN,
  vacancyRate: 0,
  propertyTax: 0,
  condoCharges: 0,
  pno: 0,
  accounting: 0,
  maintenance: 0,
  otherExpenses: 0,
  managementRate: 0,
  gliRate: 0,
  reserveRate: 0,
};
export default function NewProperty() {
  const { add, persistent, basePath, canEdit, busy } = useDemo();
  const router = useRouter();
  const [listing, setListing] = useState<ListingAttachment>();
  const [address, setAddress] = useState(''),
    [rooms, setRooms] = useState(0),
    [dpe, setDpe] = useState('?');
  const [v, setV] = useState(empty),
    [title, setTitle] = useState(''),
    [city, setCity] = useState(''),
    [postcode, setPostcode] = useState(''),
    [text, setText] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState('');
  const valid = investmentSchema.safeParse(v);
  function extract() {
    const data = new UserTextProvider().normalizeListing(text);
    if (data.city) setCity(data.city);
    if (data.postcode) setPostcode(data.postcode);
    setV({ ...v, price: data.price ?? v.price, area: data.area ?? v.area });
    setMessage(
      'Informations explicites extraites, à vérifier. La ville est recherchée dans les phrases décrivant le bien ; un code postal absent reste à renseigner.',
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="UNE NOUVELLE PISTE"
        title="Ajouter un bien à explorer"
        description={
          persistent
            ? 'Ce bien sera enregistré dans votre SCI. Vérifiez toutes les hypothèses.'
            : 'Saisie temporaire de démonstration. Aucune donnée n’est envoyée à un portail immobilier.'
        }
        action={false}
      />
      <ListingImport
        onApply={(data, attachment) => {
          setListing(attachment);
          setTitle(data.title ?? '');
          setCity(data.city ?? '');
          setPostcode(data.postcode ?? '');
          setAddress(data.address ?? '');
          setRooms(data.rooms ?? 0);
          setDpe(data.dpe ?? '?');
          setText(data.description);
          setConfirmed(false);
          setV((old) => ({
            ...old,
            price: data.price ?? NaN,
            area: data.area ?? NaN,
            propertyTax: attachment.normalized?.propertyTax ?? old.propertyTax,
            agencyFees: attachment.normalized?.agencyFees ?? old.agencyFees,
          }));
          setMessage(
            'Annonce transférée dans le formulaire ci-dessous. Complétez les données manquantes et vérifiez les hypothèses.',
          );
        }}
      />
      <section className="panel">
        <h2>Partir du texte d’une annonce</h2>
        <p className="muted">
          Vous pouvez aussi coller le texte que vous êtes autorisé à utiliser, puis compléter les
          champs manquants.
        </p>
        <label>
          Texte de l’annonce
          <textarea
            rows={4}
            maxLength={20000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Appartement de 60 m², prix 180 000 €…"
          />
        </label>
        <button className="button" onClick={extract} disabled={!text.trim()}>
          Extraire le prix et la surface
        </button>
        {message && (
          <p role="status" className="positive">
            {message}
          </p>
        )}
      </section>
      <section className="panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid.success || !confirmed) return;
            const id = crypto.randomUUID();
            const savedId = await add({
              id,
              title: title.trim(),
              city: city.trim(),
              postcode,
              district: address || 'Adresse non renseignée',
              address,
              listing,
              rooms,
              dpe,
              status: 'NEW',
              favorite: false,
              color: 'sage',
              description: text,
              investment: valid.data,
            });
            if (savedId) router.push(`${basePath}/biens/${savedId}`);
          }}
        >
          <h2>Renseigner les hypothèses</h2>
          <p className="muted">
            Les zéros ne sont pas des estimations : renseignez chaque poste ou confirmez qu’il est
            sans objet. Le taux et la durée doivent correspondre au financement envisagé.
          </p>
          <div className="form-grid">
            <label>
              Nom du bien
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Ville
              <input
                required
                maxLength={100}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label>
              Code postal
              <input
                required
                pattern="[0-9]{5}"
                maxLength={5}
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Adresse (facultatif)
              <input value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label>
              Nombre de pièces (0 = inconnu)
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
              />
            </label>
            <label>
              DPE déclaré
              <select aria-label="DPE déclaré" value={dpe} onChange={(e) => setDpe(e.target.value)}>
                {['?', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].map((value) => (
                  <option key={value} value={value}>
                    {value === '?' ? 'Donnée indisponible' : value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <InvestmentFields value={v} onChange={setV} />
          <RentEstimator
            key={listing?.normalized?.propertyType ?? 'manual'}
            city={city}
            postcode={postcode}
            rooms={rooms}
            investment={v}
            onChange={setV}
            initialKind={
              listing?.normalized?.propertyType === 'HOUSE'
                ? 'HOUSE'
                : listing?.normalized?.propertyType === 'APARTMENT'
                  ? 'APARTMENT'
                  : ''
            }
            disabled={!canEdit}
          />
          <ImportAnalysis investment={v} dpe={dpe} />
          <label className="checkbox confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            {persistent
              ? 'J’ai vérifié toutes les hypothèses, y compris les postes à zéro, avant enregistrement.'
              : 'J’ai vérifié les hypothèses, y compris les postes à zéro. Je comprends que ce bien disparaîtra au rechargement.'}
          </label>
          {!valid.success && (
            <p className="muted">
              Le prix, la surface et le loyer doivent être renseignés. L’apport ne peut dépasser le
              coût total.
            </p>
          )}
          <button
            type="submit"
            className="button primary"
            disabled={
              !valid.success || !confirmed || !title.trim() || !city.trim() || !canEdit || busy
            }
          >
            {persistent ? 'Enregistrer le bien' : 'Créer l’analyse temporaire'}
          </button>
        </form>
      </section>
    </>
  );
}
