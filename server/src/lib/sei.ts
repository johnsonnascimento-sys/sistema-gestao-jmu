export const SEI_REGEX = /^(?:\d{6}\/\d{2}-\d{2}\.\d{2,3}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})$/;

export function isValidSei(value: string) {
  return SEI_REGEX.test(value.trim());
}
