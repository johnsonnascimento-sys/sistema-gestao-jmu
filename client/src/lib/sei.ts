const SHORT_SEI_REGEX = /^\d{6}\/\d{2}-\d{2}\.\d{3}$/;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 13);
}

export function formatSeiInput(value: string) {
  const digits = onlyDigits(value);
  const parts = [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8, 10), digits.slice(10, 13)].filter(Boolean);
  let formatted = parts[0] ?? "";

  if (parts[1]) {
    formatted += `/${parts[1]}`;
  }

  if (parts[2]) {
    formatted += `-${parts[2]}`;
  }

  if (parts[3]) {
    formatted += `.${parts[3]}`;
  }

  return formatted;
}

export function normalizeSeiValue(value: string) {
  return formatSeiInput(value).replace(/\.$/, "");
}

export function isValidSei(value: string) {
  return SHORT_SEI_REGEX.test(value.trim());
}
