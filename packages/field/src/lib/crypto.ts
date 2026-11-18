export const randomUUID = () => crypto.randomUUID();
export const getRandomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
