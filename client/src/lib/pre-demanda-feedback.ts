import { ApiError, appendRequestReference, formatAppError } from "./api";

export function formatPreDemandaMutationError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return formatAppError(error, fallback);
  }

  switch (error.code) {
    case "PRE_DEMANDA_NOT_FOUND":
      return appendRequestReference("A demanda informada nao foi encontrada.", error.requestId);
    case "PRE_DEMANDA_STATUS_UNCHANGED":
      return appendRequestReference("A demanda ja se encontra nesse status.", error.requestId);
    case "PRE_DEMANDA_STATUS_INVALID":
      return appendRequestReference(error.message || "A transicao de status nao e permitida para a situacao actual da demanda.", error.requestId);
    case "PRE_DEMANDA_STATUS_REASON_REQUIRED":
      return appendRequestReference("Informe o motivo para encerrar ou reabrir a demanda.", error.requestId);
    case "VALIDATION_ERROR":
      return appendRequestReference("Revise os campos informados e tente novamente.", error.requestId);
    default:
      return appendRequestReference(error.message || fallback, error.requestId);
  }
}
