export type ExtractPromiseResolveValue<T> = T extends Promise<infer U> ? U : never;
