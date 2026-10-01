'use client';
import { useState } from 'react';
import { PropertyArt } from './property-art';
export function PropertyPhoto({
  url,
  title,
  variant,
  synthetic,
  large = false,
}: {
  url?: string;
  title: string;
  variant: string;
  synthetic: boolean;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element -- No server proxy for arbitrary external photos.
    <img
      className="property-photo"
      src={url}
      alt={title}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <PropertyArt variant={variant} synthetic={synthetic} large={large} />
  );
}
