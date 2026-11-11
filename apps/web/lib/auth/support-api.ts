import { isRecord, orNull, request } from "./api";

/**
 * Typed client for support tickets (contract C). Same rules as the rest of lib/auth/api.ts:
 * nothing throws, every call resolves to an ApiResult, nothing logs (messages are user data).
 *
 * - POST /api/me/support {kind, category?, subject?, message, context?} + X-Captcha-Response -> 201 {ticket}.
 *   400 invalid_request / captcha_required / captcha_failed, 429 rate_limited (retryAfterSeconds).
 * - GET  /api/me/support -> {tickets} (no messages), newest first.
 * - GET  /api/me/support/{id} -> {ticket} with messages. 404 not_found.
 * - POST /api/me/support/{id}/messages {message} -> 201 {ticket}. 409 ticket_closed.
 * Times are ISO 8601 strings.
 */
export const TICKET_KINDS = ["support", "report"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

export const TICKET_STATUSES = ["open", "replied", "resolved", "fixed", "cant_reproduce"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type TicketMessage = {
  id: string;
  author: "you" | "support";
  body: string;
  createdAt: string;
};

export type TicketContext = { resource: string | null; where: string | null; link: string | null };

export type Ticket = {
  id: string;
  kind: TicketKind;
  category: string | null;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  context: TicketContext | null;
  /** Only on the detail answer and on the answers to a send. */
  messages?: TicketMessage[];
};

export type NewTicket = {
  kind: TicketKind;
  category?: string;
  subject?: string;
  message: string;
  context?: { resource?: string; where?: string; link?: string };
  /** Turnstile token, sent as X-Captcha-Response. */
  captchaToken?: string | null;
};

const isTime = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Exported for tests. Undefined when the payload is not a usable message. */
export function parseTicketMessage(json: unknown): TicketMessage | undefined {
  if (!isRecord(json)) return undefined;
  const { id, author, body, createdAt } = json;
  if (typeof id !== "string" || typeof body !== "string" || !isTime(createdAt)) return undefined;
  if (author !== "you" && author !== "support") return undefined;
  return { id, author, body, createdAt };
}

function parseContext(json: unknown): TicketContext | null {
  if (!isRecord(json)) return null;
  const context = {
    resource: orNull(json.resource),
    where: orNull(json.where),
    link: orNull(json.link),
  };
  return context.resource || context.where || context.link ? context : null;
}

/** Exported for tests. Undefined when the payload is not a usable ticket. */
export function parseTicket(json: unknown): Ticket | undefined {
  if (!isRecord(json)) return undefined;
  const { id, kind, subject, status, createdAt, updatedAt } = json;
  if (typeof id !== "string" || id === "" || typeof subject !== "string") return undefined;
  if (!oneOf(TICKET_KINDS, kind) || !oneOf(TICKET_STATUSES, status)) return undefined;
  if (!isTime(createdAt) || !isTime(updatedAt)) return undefined;
  const ticket: Ticket = {
    id,
    kind,
    category: orNull(json.category),
    subject,
    status,
    createdAt,
    updatedAt,
    messageCount: typeof json.messageCount === "number" ? json.messageCount : 0,
    context: parseContext(json.context),
  };
  if (Array.isArray(json.messages)) {
    ticket.messages = json.messages.flatMap((row) => {
      const parsed = parseTicketMessage(row);
      return parsed ? [parsed] : [];
    });
    ticket.messageCount = Math.max(ticket.messageCount, ticket.messages.length);
  }
  return ticket;
}

/** Exported for tests. Rows that cannot be read are dropped; an answer without a list is invalid. */
export function parseTicketList(json: unknown): Ticket[] | undefined {
  if (!isRecord(json) || !Array.isArray(json.tickets)) return undefined;
  return json.tickets.flatMap((row) => {
    const parsed = parseTicket(row);
    return parsed ? [parsed] : [];
  });
}

const parseOne = (json: unknown) => (isRecord(json) ? parseTicket(json.ticket) : undefined);

const ticketPath = (id: string) => `/api/me/support/${encodeURIComponent(id)}`;

export function createTicket(input: NewTicket, signal?: AbortSignal) {
  const { captchaToken, ...body } = input;
  return request("POST", "/api/me/support", { body, captchaToken, signal }, parseOne);
}

export function listTickets(signal?: AbortSignal) {
  return request("GET", "/api/me/support", { signal }, parseTicketList);
}

export function getTicket(id: string, signal?: AbortSignal) {
  return request("GET", ticketPath(id), { signal }, parseOne);
}

export function replyToTicket(id: string, message: string, signal?: AbortSignal) {
  return request("POST", `${ticketPath(id)}/messages`, { body: { message }, signal }, parseOne);
}
