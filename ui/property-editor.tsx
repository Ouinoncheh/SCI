'use client';
import { useState } from 'react';
import type { DemoProperty } from '../data/demo';
import { propertyDetailsSchema, type PropertyDetails } from '../property-details';
import { useDemo } from './demo-context';

export function PropertyEditor({ property: p }: { property: DemoProperty }) {
  const { canEdit, busy, persistent, saveDetails } = useDemo();
  const [version, setVersion] = useState(p.version);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<PropertyDetails>({
    title: p.title,
    city: p.city,
    postcode: p.postcode,
    address: p.address ?? '',
    rooms: p.rooms,
    dpe: propertyDetailsSchema.shape.dpe.parse(p.dpe),
    description: p.description,
  });
  const valid = propertyDetailsSchema.safeParse(draft);
  function change<K extends keyof PropertyDetails>(key: K, value: PropertyDetails[K]) {
    setSaved(false);
    setDraft((old) => ({ ...old, [key]: value }));
  }
  return (
    <form
      className="panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid.success || !canEdit) return;
        if (await saveDetails(p.id, valid.data, version)) {
          setVersion((v) => (v === undefined ? undefined : v + 1));
          setSaved(true);
        }
      }}
    >
      <h2>Caractéristiques du bien</h2>
      <p className="muted">
        Informations déclarées par votre famille. Le prix et la surface se modifient dans l’onglet
        Hypothèses.
      </p>
      {!canEdit && <p>Votre rôle lecteur permet uniquement de consulter cette fiche.</p>}
      <fieldset disabled={!canEdit || busy} className="property-editor-fields">
        <div className="form-grid">
          {(
            [
              ['title', 'Titre du bien', 120],
              ['city', 'Ville', 100],
              ['postcode', 'Code postal', 5],
              ['address', 'Adresse (facultatif)', 300],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                value={draft[key]}
                maxLength={max}
                required={key !== 'address'}
                pattern={key === 'postcode' ? '[0-9]{5}' : undefined}
                onChange={(e) => change(key, e.target.value)}
              />
            </label>
          ))}
          <label>
            Nombre de pièces (0 = inconnu)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={draft.rooms}
              onChange={(e) => change('rooms', Number(e.target.value))}
            />
          </label>
          <label>
            DPE déclaré
            <select
              aria-label="DPE déclaré"
              value={draft.dpe}
              onChange={(e) => change('dpe', e.target.value as PropertyDetails['dpe'])}
            >
              {['?', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].map((value) => (
                <option key={value} value={value}>
                  {value === '?' ? 'Donnée indisponible' : value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="property-description">
          Description
          <textarea
            rows={6}
            maxLength={20000}
            value={draft.description}
            onChange={(e) => change('description', e.target.value)}
          />
        </label>
        <p className="muted">
          Le DPE déclaré intervient dans le score. Ces corrections ne changent pas les hypothèses
          financières enregistrées.
        </p>
        {!valid.success && (
          <p role="alert">
            Vérifiez le titre (2 caractères minimum), la ville, le code postal (5 chiffres) et le
            nombre entier de pièces.
          </p>
        )}
        <button className="button primary" disabled={!valid.success || busy} type="submit">
          Enregistrer les caractéristiques
        </button>
      </fieldset>
      {saved && (
        <p role="status">
          {persistent
            ? 'Caractéristiques enregistrées.'
            : 'Caractéristiques modifiées pour cette démonstration ; elles seront réinitialisées au rechargement.'}
        </p>
      )}
    </form>
  );
}
