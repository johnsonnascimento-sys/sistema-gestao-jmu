const NUMERO_JUDICIAL_DIGITS = 20;
const NUMERO_JUDICIAL_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

export function formatNumeroJudicialInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, NUMERO_JUDICIAL_DIGITS);

  if (!digits) {
    return "";
  }

  const parts = [
    digits.slice(0, 7),
    digits.slice(7, 9),
    digits.slice(9, 13),
    digits.slice(13, 14),
    digits.slice(14, 16),
    digits.slice(16, 20),
  ];

  let formatted = parts[0];
  if (digits.length > 7) formatted += `-${parts[1]}`;
  if (digits.length > 9) formatted += `.${parts[2]}`;
  if (digits.length > 13) formatted += `.${parts[3]}`;
  if (digits.length > 14) formatted += `.${parts[4]}`;
  if (digits.length > 16) formatted += `.${parts[5]}`;
  return formatted;
}

export function normalizeNumeroJudicialValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return formatNumeroJudicialInput(value);
}

export function isValidNumeroJudicial(value: string) {
  return NUMERO_JUDICIAL_REGEX.test(value);
}
