export function formatDateOnlyPtBr(value: string | null | undefined, fallback = "-") {
  if (!value) {
    return fallback;
  }

  const normalized = value.includes("T") ? value : `${value}T00:00:00Z`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function formatDateTimePtBr(value: string | null | undefined, fallback = "-") {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
