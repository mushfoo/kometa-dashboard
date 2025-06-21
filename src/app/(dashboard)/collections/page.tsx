'use client';

import { CollectionBuilder } from '@/components/collections/CollectionBuilder';

export default function CollectionsPage() {
  const handleSaveCollection = (collection: any) => {
    console.log('Saving collection:', collection);
    // TODO: Implement API call to save collection
  };

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Collections</h1>
      <CollectionBuilder onSave={handleSaveCollection} />
    </>
  );
}
