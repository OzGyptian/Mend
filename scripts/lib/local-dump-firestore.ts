import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// A drop-in stand-in for the tiny slice of the firebase-admin Firestore API
// the ETL script actually uses: collection(name).get(), .where(field, '==',
// value).get(), .doc(id).get(), and one level of subcollection
// (sheets/{id}/rows). Backed by JSON files written once by dump-firestore.ts
// instead of live reads -- every subsequent ETL run/debug iteration against
// the same dump costs zero Firestore quota. Only '==' is implemented since
// it's the only operator the ETL ever uses.

interface RawDoc {
  __id: string;
  [key: string]: unknown;
}

interface FakeDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown>;
}

interface FakeQuerySnapshot {
  docs: FakeDocSnapshot[];
  empty: boolean;
  size: number;
}

function toDocSnapshot(raw: RawDoc): FakeDocSnapshot {
  const { __id, ...data } = raw;
  return { id: __id, exists: true, data: () => data };
}

function loadCollection(dumpDir: string, name: string): RawDoc[] {
  const path = join(dumpDir, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `No dump found for collection "${name}" at ${path} -- run scripts/dump-firestore.ts first, or check --from-dump points at the right directory.`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadSheetRows(dumpDir: string): Record<string, RawDoc[]> {
  const path = join(dumpDir, 'sheet-rows.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

class FakeQuery {
  constructor(private docs: RawDoc[]) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    if (op !== '==') throw new Error(`local-dump-firestore only supports '==', got '${op}'`);
    return new FakeQuery(this.docs.filter((d) => d[field] === value));
  }

  async get(): Promise<FakeQuerySnapshot> {
    const docs = this.docs.map(toDocSnapshot);
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

class FakeDocRef {
  constructor(
    private dumpDir: string,
    private collectionName: string,
    private id: string,
  ) {}

  async get(): Promise<FakeDocSnapshot> {
    const docs = loadCollection(this.dumpDir, this.collectionName);
    const found = docs.find((d) => d.__id === this.id);
    if (!found) return { id: this.id, exists: false, data: () => ({}) };
    return toDocSnapshot(found);
  }

  collection(subName: string): FakeQuery {
    if (this.collectionName !== 'sheets' || subName !== 'rows') {
      throw new Error(`local-dump-firestore only supports the sheets/{id}/rows subcollection, got ${this.collectionName}/{id}/${subName}`);
    }
    const rows = loadSheetRows(this.dumpDir)[this.id] ?? [];
    return new FakeQuery(rows);
  }
}

class FakeCollectionRef extends FakeQuery {
  constructor(
    private dumpDir: string,
    private name: string,
  ) {
    super(loadCollection(dumpDir, name));
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.dumpDir, this.name, id);
  }
}

export interface LocalDumpFirestore {
  collection(name: string): FakeCollectionRef;
}

export function createLocalDumpFirestore(dumpDir: string): LocalDumpFirestore {
  return {
    collection: (name: string) => new FakeCollectionRef(dumpDir, name),
  };
}
