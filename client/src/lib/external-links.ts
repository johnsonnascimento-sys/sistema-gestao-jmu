export function getEscalaPlantaoUrl() {
  const value = import.meta.env.VITE_ESCALA_PLANTAO_URL?.trim();

  if (!value) {
    return null;
  }

  return value;
}
