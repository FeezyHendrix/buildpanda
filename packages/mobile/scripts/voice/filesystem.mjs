export const Paths = { document: 'file:///fixture' };
export class Directory {
  constructor(...parts) { this.uri = parts.map((p) => p.uri ?? p).join('/'); }
  exists = true;
  create() {}
  list() { return []; }
  delete() {}
}
export class File extends Directory {
  size = 256;
  copy() {}
  move() {}
  get name() { return this.uri.split('/').at(-1); }
  get parentDirectory() { return new Directory(this.uri.split('/').slice(0, -1).join('/')); }
  static async downloadFileAsync(_url, destination) { return destination; }
}
