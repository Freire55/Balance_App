export class File {
  constructor(public dir: string, public name: string) {}
  content = '';
  get exists() { return true; }
  delete() {}
  create() {}
  write(data: string) { this.content = data; }
  get uri() { return `file://${this.dir}/${this.name}`; }
}

export const Paths = {
  cache: '/mock/cache',
};
