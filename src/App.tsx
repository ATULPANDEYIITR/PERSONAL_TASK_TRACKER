import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, importSeed } from './db';
import type { SeedFile } from './types';

/** Step 1 shell: import the migrated data and prove the database works. The real UI starts in Step 3. */
export default function App() {
  const [message, setMessage] = useState('');
  const counts = useLiveQuery(async () => ({
    categories: await db.categories.count(),
    items: await db.items.count(),
    tasks: await db.tasks.count(),
  }));

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const seed = JSON.parse(await file.text()) as SeedFile;
      await importSeed(seed);
      setMessage('Import complete.');
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>Task Tracker</h1>
      <p>Import <code>data/private/seed.json</code> to load your data.</p>
      <input type="file" accept="application/json" onChange={(e) => onFile(e.target.files?.[0])} />
      {message && <p>{message}</p>}
      {counts && (
        <ul>
          <li>Categories: {counts.categories}</li>
          <li>Items: {counts.items}</li>
          <li>Tasks: {counts.tasks}</li>
        </ul>
      )}
    </main>
  );
}
