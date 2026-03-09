const BACKEND_SEI_REGEX = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 20);
}

export function formatSeiInput(value: string) {
  const digits = onlyDigits(value);

  if (digits.length <= 7) {
    return digits;
  }

  if (digits.length <= 18) {
    const parts = [
      digits.slice(0, 6),
      digits.slice(6, 8),
      digits.slice(8, 10),
      digits.slice(10, 13),
    ].filter(Boolean);

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

  const groups = [7, 2, 4, 1, 2, 4];
  const separators = ["-", ".", ".", ".", ""];
  let offset = 0;
  let formatted = "";

  groups.forEach((size, index) => {
    const chunk = digits.slice(offset, offset + size);

    if (!chunk) {
      return;
    }

    formatted += chunk;
    offset += size;

    if (chunk.length === size && separators[index]) {
      formatted += separators[index];
    }
  });

  return formatted;
}

export function normalizeSeiValue(value: string) {
  return formatSeiInput(value).replace(/\.$/, "");
}

export function isValidSei(value: string) {
  return BACKEND_SEI_REGEX.test(value.trim());
}
