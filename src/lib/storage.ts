// Browser-local persistence (IndexedDB). Swap this module for a backend later
// without touching the UI: it is the only place documents are read/written.
import { del, get, getMany, keys, set } from "idb-keyval";
import type { DocRecord } from "./types";

const key = (id: string) => `doc:${id}`;

export async function saveDoc(doc: DocRecord) {
  await set(key(doc.id), doc);
}

export async function loadDoc(id: string) {
  return (await get<DocRecord>(key(id))) ?? null;
}

export async function deleteDoc(id: string) {
  await del(key(id));
}

export async function listDocs(): Promise<DocRecord[]> {
  const docKeys = (await keys()).filter((k) => String(k).startsWith("doc:"));
  const docs = (await getMany<DocRecord>(docKeys)).filter(Boolean);
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}
