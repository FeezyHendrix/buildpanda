import { AppError } from "../../lib/errors.ts";

export class MessagingClarificationError extends AppError {
  constructor(message: string) {
    super(message, { statusCode: 400, code: "messaging_clarification_needed" });
  }
}

export class MessagingAnswerResult extends Error {
  constructor(public readonly answer: string) { super(answer); }
}
