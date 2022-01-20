import {Actor} from './actor';

export class Actors<T extends Actor> extends Map<string, T> {
  add(actor: T) {
    if (super.has(actor.id) && super.get(actor.id) !== actor) {
      throw new Error(`${actor.constructor.name} with id ${actor.id} is already exists`);
    }
    super.set(actor.id, actor);
  }

  remove(actor: string | T) {
    super.delete(typeof actor === 'string' ? actor : actor.id);
  }
}
