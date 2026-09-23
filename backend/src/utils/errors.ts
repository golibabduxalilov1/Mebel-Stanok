export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (message = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', message),
  invalidCredentials: () => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username/email or password'),
  forbidden: (message = 'You do not have permission to perform this action') => new ApiError(403, 'FORBIDDEN', message),
  notFound: (entity = 'Resource') => new ApiError(404, 'NOT_FOUND', `${entity} not found`),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  badRequest: (message: string, code = 'BAD_REQUEST') => new ApiError(400, code, message),
};
