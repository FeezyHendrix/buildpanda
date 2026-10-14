import type { Db } from "./client";

const owners = new WeakMap<Db, string>();
export const setDbOwner = (db: Db, ownerId: string) => { owners.set(db, ownerId); };
export const getDbOwner = (db: Db): string | undefined => owners.get(db);
