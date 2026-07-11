export interface VersionedRecord {
  readonly id: string;
  readonly version: number;
}

export type Result<T, E extends Error = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error });
