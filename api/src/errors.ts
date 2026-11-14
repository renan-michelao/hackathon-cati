/** Erro de regra de negócio com status HTTP e código estável para o front. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
