declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '@netlify/blobs' {
  // Retrieves a blob by its id. Returns a Buffer if found, or null otherwise.
  export function getBlob(id: string): Promise<Buffer | null>;
  
  // Saves a blob with the given id and data.
  export function putBlob(id: string, data: Buffer): Promise<void>;
}
