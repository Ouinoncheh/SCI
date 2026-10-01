'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDemo } from './demo-context';
import { api } from './http';
import { roomSchema, roomTypes, type GalleryRoom, type GalleryPhoto } from '@/visualization/types';

function PhotoEditor({
  photo,
  roomId,
  rooms,
  base,
  refresh,
}: {
  photo: GalleryPhoto;
  roomId: string;
  rooms: GalleryRoom[];
  base: string;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  return (
    <details>
      <summary>Modifier la photo</summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError('');
          setSaved(false);
          try {
            await api(`${base}/photos/${photo.id}`, 'PATCH', {
              angleLabel: form.get('angleLabel'),
              comment: form.get('comment'),
              roomId: form.get('roomId'),
              makeCover: form.get('makeCover') === 'on',
              expected: {
                roomId,
                angleLabel: photo.angleLabel,
                comment: photo.comment,
                isCover: photo.isCover,
              },
            });
            await refresh();
            setSaved(true);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="property-editor-fields">
          <label>
            Angle de la photo
            <input name="angleLabel" maxLength={100} defaultValue={photo.angleLabel} />
          </label>
          <label>
            Commentaire de la photo
            <textarea name="comment" maxLength={2000} defaultValue={photo.comment} />
          </label>
          <label>
            Pièce de destination
            <select name="roomId" defaultValue={roomId}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" name="makeCover" /> Choisir comme couverture de la pièce
          </label>
          <button className="button" type="submit">
            {busy ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Photo mise à jour.</p>}
      </form>
    </details>
  );
}

export function RoomGallery({ propertyId }: { propertyId: string }) {
  const { workspace, canEdit } = useDemo();
  const base = workspace?.sci
    ? `/api/workspace/scis/${workspace.sci.id}/properties/${propertyId}`
    : null;
  const [rooms, setRooms] = useState<GalleryRoom[]>([]),
    [selected, setSelected] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState('');
  const [name, setName] = useState(''),
    [roomType, setRoomType] = useState<(typeof roomTypes)[number]>('Salon');
  const [floor, setFloor] = useState(''),
    [area, setArea] = useState(''),
    [notes, setNotes] = useState('');
  const [angle, setAngle] = useState(''),
    [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    let active = true;
    if (base)
      api<GalleryRoom[]>(`${base}/rooms`)
        .then((data) => {
          if (active) {
            setRooms(data);
            setSelected(data[0]?.id ?? '');
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [base]);
  async function refresh() {
    if (base) setRooms(await api<GalleryRoom[]>(`${base}/rooms`));
  }
  const current = rooms.find((r) => r.id === selected);
  if (!base)
    return (
      <section className="panel">
        <h2>Vos pièces et photos</h2>
        <p>
          Ajoutez vos photos dans votre espace connecté pour les conserver et les partager avec
          votre SCI.
        </p>
        <Link className="button" href="/espace">
          Ouvrir mon espace
        </Link>
        <p className="muted">
          Les projets de projection après travaux sont disponibles dans l’espace connecté.
        </p>
      </section>
    );
  return (
    <section className="panel room-gallery">
      <h2>Vos pièces et photos</h2>
      <p>Classez les photos actuelles du bien pour préparer vos projets de rénovation.</p>
      <p className="demo-notice">
        Photos originales du bien. Préparez vos projections après travaux dans la section suivante.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading && <p>Chargement de la galerie…</p>}
      {canEdit && (
        <details>
          <summary>Ajouter une pièce</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setMessage('');
              const valid = roomSchema.safeParse({
                name,
                roomType,
                floor: floor === '' ? null : Number(floor),
                areaEstimate: area === '' ? null : Number(area),
                notes,
              });
              if (!valid.success) {
                setError('Vérifiez le nom, l’étage et la surface de la pièce.');
                return;
              }
              setBusy(true);
              try {
                const result = await api<{ id: string }>(`${base}/rooms`, 'POST', valid.data);
                await refresh();
                setSelected(result.id);
                setName('');
                setFloor('');
                setArea('');
                setNotes('');
                setMessage('Pièce créée.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="property-editor-fields">
              <div className="form-grid">
                <label>
                  Nom de la pièce
                  <input
                    required
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Salon du rez-de-chaussée"
                  />
                </label>
                <label>
                  Type de pièce
                  <select
                    aria-label="Type de pièce"
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value as typeof roomType)}
                  >
                    {roomTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Étage (facultatif)
                  <input
                    type="number"
                    min={-10}
                    max={200}
                    step={1}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                  />
                </label>
                <label>
                  Surface estimée en m² (facultatif)
                  <input
                    type="number"
                    min={0.01}
                    max={10000}
                    step="any"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </label>
                <label>
                  Notes sur la pièce
                  <textarea
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <button className="button primary" disabled={busy}>
                Créer la pièce
              </button>
            </fieldset>
          </form>
        </details>
      )}
      <div className="room-selector">
        {rooms.map((r) => (
          <button
            className="button"
            aria-pressed={selected === r.id}
            key={r.id}
            onClick={() => {
              setSelected(r.id);
              setMessage('');
            }}
          >
            {r.name} · {r.photos.length} photo(s)
          </button>
        ))}
      </div>
      {!loading && !rooms.length && (
        <p>Aucune pièce. Ajoutez une pièce pour y classer vos photos.</p>
      )}
      {current && (
        <>
          <h3>{current.name}</h3>
          <p>
            {current.roomType} ·{' '}
            {current.floor === null ? 'Étage non renseigné' : `Étage ${current.floor}`} ·{' '}
            {current.areaEstimate === null
              ? 'Surface non renseignée'
              : `${current.areaEstimate} m² estimés`}
          </p>
          <p>{current.notes}</p>
          {canEdit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formElement = e.currentTarget;
                setBusy(true);
                setError('');
                setMessage('');
                let count = 0;
                try {
                  for (const file of files) {
                    const body = new FormData();
                    body.set('photo', file);
                    body.set('angleLabel', angle);
                    body.set('comment', comment);
                    const response = await fetch(`${base}/rooms/${current.id}/photos`, {
                      method: 'POST',
                      body,
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error ?? 'Envoi impossible.');
                    count++;
                  }
                  setFiles([]);
                  setAngle('');
                  setComment('');
                  formElement.reset();
                } catch (e) {
                  setError(
                    `${count} photo(s) ajoutée(s). ${(e as Error).message} Retirez les fichiers déjà envoyés avant de réessayer.`,
                  );
                } finally {
                  try {
                    await refresh();
                  } catch {
                    setError('Actualisation impossible. Rechargez la page.');
                  }
                  setMessage(`${count} photo(s) enregistrée(s).`);
                  setBusy(false);
                }
              }}
            >
              <fieldset className="property-editor-fields" disabled={busy}>
                <label className="property-description">
                  Ajouter des photos
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const chosen = Array.from(e.target.files ?? []);
                      setError('');
                      if (chosen.length > 10 || chosen.some((f) => f.size > 8 * 1024 * 1024)) {
                        setError('10 photos par envoi, 8 Mo maximum par photo.');
                        setFiles([]);
                        e.target.value = '';
                      } else setFiles(chosen);
                    }}
                  />
                </label>
                <p className="muted">
                  JPEG, PNG ou WebP · 8 Mo / photo · 100 photos / bien. Les images sont
                  redimensionnées ; les métadonnées de localisation sont supprimées. Sur iPhone,
                  exportez les photos HEIC en JPEG.
                </p>
                <div className="form-grid">
                  <label>
                    Angle de vue
                    <input
                      maxLength={100}
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      placeholder="Depuis l’entrée"
                    />
                  </label>
                  <label>
                    Commentaire des photos
                    <textarea
                      maxLength={2000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </label>
                </div>
                <button className="button primary" disabled={!files.length || busy}>
                  {busy ? 'Envoi en cours…' : 'Enregistrer les photos'}
                </button>
              </fieldset>
            </form>
          )}
          {!canEdit && <p>Votre rôle lecteur permet de consulter les photos.</p>}
          <div className="room-photos">
            {current.photos.map((photo) => (
              <figure key={photo.id}>
                <a href={`${base}/photos/${photo.id}`} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated private image route, no optimizer cache. */}
                  <img
                    src={`${base}/photos/${photo.id}?thumbnail=1`}
                    alt={`${current.name} — ${photo.angleLabel || 'vue sans précision'}`}
                    loading="lazy"
                  />
                </a>
                <figcaption>
                  <strong>{photo.angleLabel || 'Angle non renseigné'}</strong>
                  <p>{photo.comment}</p>
                  <small>
                    {photo.width} × {photo.height} ·{' '}
                    {new Date(photo.uploadedAt).toLocaleDateString('fr-FR')}
                    {photo.isCover ? ' · Couverture' : ''}
                  </small>
                </figcaption>
                {canEdit && (
                  <PhotoEditor
                    photo={photo}
                    roomId={current.id}
                    rooms={rooms}
                    base={base}
                    refresh={refresh}
                  />
                )}
              </figure>
            ))}
          </div>
          {!current.photos.length && <p>Aucune photo pour cette pièce.</p>}
        </>
      )}
    </section>
  );
}
