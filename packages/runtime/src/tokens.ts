export interface ServiceToken<T> {
  readonly key: symbol;
  readonly description: string;
  readonly __type?: T;
}

export const createServiceToken = <T>(description: string): ServiceToken<T> => ({
  key: Symbol(description),
  description,
});
