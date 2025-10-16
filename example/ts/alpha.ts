import { greet } from './utils';

export function main(name: string) {
  log(greet(name));
}

function log(msg: string) {
  console.log(msg);
}

export class Person {
  constructor(public name: string) {}
  speak() {
    return greet(this.name);
  }
}
