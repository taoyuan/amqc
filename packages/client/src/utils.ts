import uniqid from 'uniqid';

export function genName(type: string) {
  return uniqid(`hamq.${type.toLowerCase()}-`);
}
