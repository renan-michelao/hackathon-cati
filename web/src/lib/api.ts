// Cliente HTTP e tipos compartilhados com a API (contrato em docs/API.md).

export type AuctionStatus = 'SCHEDULED' | 'LIVE' | 'SOLD' | 'ENDED_NO_BIDS' | 'CANCELLED';

export interface User {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  avatarUrl: string | null;
}

export interface AuctionSummary {
  id: string;
  itemId: string;
  name: string;
  category: string;
  status: AuctionStatus;
  startPriceCents: number;
  currentPriceCents: number | null;
  minNextCents: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  coverUrl: string | null;
  seller: { id: string; displayName: string };
}

export type EditPolicy = 'ALL' | 'APPEND_DESCRIPTION' | 'NONE';

export interface AuctionDetail extends AuctionSummary {
  description: string;
  photos: string[];
  editPolicy: EditPolicy;
  canCancel: boolean;
  canRelist: boolean;
  serverNow: string;
}

export type RoomMode = 'participant' | 'spectator';

export interface Presence {
  auctionId: string;
  participants: number;
  spectators: number;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  createdAt: string;
  avatarUrl: string | null;
  auctions: { scheduled: AuctionSummary[]; live: AuctionSummary[]; past: AuctionSummary[] };
}

export interface SellerHit {
  id: string;
  displayName: string;
  createdAt: string;
  avatarUrl: string | null;
  auctionCount: number;
}

export interface Participation {
  auctionId: string;
  name: string;
  category: string;
  status: AuctionStatus;
  coverUrl: string | null;
  myBestCents: number;
  myBidCount: number;
  currentPriceCents: number | null;
  minNextCents: number;
  endsAt: string;
  situation: 'leader' | 'outbid' | 'winner';
}

export interface OutbidEvent {
  auctionId: string;
  name: string | null;
  amountCents: number;
  minNextCents: number;
}

export interface RoomBid {
  id: string;
  amountCents: number;
  at: string;
  bidderId: string;
  bidderAlias: string | null;
}

export interface RoomState {
  id: string;
  name: string;
  description: string;
  status: AuctionStatus;
  startPriceCents: number;
  currentPriceCents: number | null;
  minNextCents: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  sellerId: string;
  leaderId: string | null;
  leaderAlias: string | null;
  winnerId: string | null;
  winnerAlias: string | null;
  finalPriceCents: number | null;
  recentBids: RoomBid[];
  serverNow: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AppConfig {
  categories: string[];
  limits: {
    nameMax: number;
    descriptionMax: number;
    photosMin: number;
    photosMax: number;
    photoMaxBytes: number;
    leadMinSec: number;
    leadMaxDays: number;
    durationMinSec: number;
    durationMaxSec: number;
  };
  serverNow: string;
}

export type BidResponse =
  | { accepted: true; replay: boolean; bid: { id: string; amountCents: number; at: string }; minNextCents: number }
  | { accepted: false; code: string; message: string; minNextCents: number | null };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: unknown) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body && !(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  const r = await fetch(path, { credentials: 'same-origin', ...init, headers: { ...headers, ...(init.headers as object) } });
  const text = await r.text();
  const body = text ? JSON.parse(text) : null;
  if (!r.ok) throw new ApiError(r.status, body?.error ?? body?.code ?? 'ERROR', body?.message ?? 'Erro inesperado.', body);
  return body as T;
}

export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined });

export const patch = <T>(path: string, data: FormData) => api<T>(path, { method: 'PATCH', body: data });
