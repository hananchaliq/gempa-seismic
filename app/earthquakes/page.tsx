import React from 'react';
import { getSeismicDataset } from '@/lib/earthquakes/service';
import { CatalogExplorerClient } from '@/components/catalog/CatalogExplorerClient';

export const dynamic = 'force-dynamic';

export default async function LiveMonitoringPage() {
  const dataset = await getSeismicDataset();
  return <CatalogExplorerClient initialDataset={dataset} defaultMode="map" />;
}
