import Dexie, { type Table } from 'dexie';
import type { Category, Item, SeedFile, Task } from './types';

export class TrackerDB extends Dexie {
  categories!: Table<Category, string>;
  items!: Table<Item, string>;
  tasks!: Table<Task, string>;

  constructor() {
    super('task-tracker');
    this.version(1).stores({
      categories: 'id, group, order',
      // '&dedupeKey' = UNIQUE index: the database itself refuses a duplicate task or item.
      items: 'id, categoryId, &dedupeKey, updatedAt',
      tasks: 'id, categoryId, itemId, status, dueDate, &dedupeKey, updatedAt',
    });
  }
}

export const db = new TrackerDB();

/** Normalise text the same way the Python migration does, so both sides agree on "duplicate". */
export function normaliseKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Load the file produced by scripts/migrate_excel.py. Safe to run repeatedly (upserts by id). */
export async function importSeed(seed: SeedFile): Promise<void> {
  await db.transaction('rw', db.categories, db.items, db.tasks, async () => {
    await db.categories.bulkPut(seed.categories);
    await db.items.bulkPut(seed.items);
    await db.tasks.bulkPut(seed.tasks);
  });
}
