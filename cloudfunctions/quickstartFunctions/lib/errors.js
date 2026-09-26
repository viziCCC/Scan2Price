class BusinessError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.details = details;
  }
}

module.exports = { BusinessError };
