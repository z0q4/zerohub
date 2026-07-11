export type PythonRequest = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
};

export type PythonSuccessResponse<T> = {
  id: string;
  ok: true;
  result: T;
};

export type PythonErrorResponse = {
  id: string | null;
  ok: false;

  error: {
    type: string;
    message: string;
  };
};

export type PythonResponse<T> =
  | PythonSuccessResponse<T>
  | PythonErrorResponse;
