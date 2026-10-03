/**
 * Data model. Nothing here is hardcoded to a specific category:
 * categories and their fields are DATA, so you can add, rename or delete them from the UI.
 */

export type FieldType =
  | 'text'
  | 'url'
  | 'date'
  | 'number'
  | 'boolean'
  | 'select'
  | 'relation'; // points at an item in another category (e.g. a social account -> its company)

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // for 'select'
  relationCategoryId?: string; // for 'relation'
  sensitive?: boolean; // UI masks these (PAN, GST, bank, password vault ...)
}

export interface Category {
  id: string;
  name: string;
  group: string; // sidebar section, e.g. "Platforms & Profiles"
  order: number;
  color?: string;
  description?: string;
  fields: FieldDef[]; // custom columns for items in this category
  subAreas?: string[]; // optional second-level labels for tasks
}

/** A structured record: a platform account, a publication, an exam, a company ... */
export interface Item {
  id: string;
  categoryId: string;
  title: string;
  data: Record<string, string | number | boolean | null>;
  tags?: string[];
  dedupeKey: string; // `${categoryId}:${normalised title}` - unique in the DB
  createdAt: string;
  updatedAt: string;
}

export type TaskKind = 'action_task' | 'goal_reference' | 'reference_link' | 'reference_list';
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done';
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  categoryId: string;
  itemId?: string; // optionally attached to an item
  subArea?: string;
  title: string; // exact source text, never reworded
  kind: TaskKind;
  status: TaskStatus;
  priority?: Priority;
  dueDate?: string; // ISO yyyy-mm-dd
  recurrence?: string; // e.g. "weekly", "every 14 days" (used in a later step)
  links: string[];
  notes?: string;
  sourceRefs: string[]; // every original sheet/row this task came from (kept after merging duplicates)
  dedupeKey: string; // normalised title - UNIQUE across all tasks, so no task can exist twice
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SeedFile {
  schemaVersion: 1;
  generatedAt: string;
  categories: Category[];
  items: Item[];
  tasks: Task[];
}
