export class AppError extends Error {
  constructor(public name: string, public message: string) {
    super(message);
    this.name = name;
  }
} 