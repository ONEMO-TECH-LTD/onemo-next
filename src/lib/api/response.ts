export function okResponse<T>(data: T) {
  return { ok: true as const, data };
}

export function errorResponse(code: string, message: string, status: number) {
  void status;

  return {
    ok: false as const,
    error: {
      code,
      message,
    },
  };
}
