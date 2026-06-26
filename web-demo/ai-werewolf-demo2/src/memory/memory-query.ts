import type { MemoryEntry, MemoryEventType, MemorySource } from '@/types';
import { HARD_INFO_THRESHOLD } from '@/constants';

export interface MemoryQueryable {
	getAll(includeForgotten?: boolean): MemoryEntry[];
}

export function aboutPlayer(store: MemoryQueryable, playerId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.actorId === playerId || e.targetId === playerId);
}

export function byActor(store: MemoryQueryable, actorId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.actorId === actorId);
}

export function byTarget(store: MemoryQueryable, targetId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.targetId === targetId);
}

export function byType(store: MemoryQueryable, type: MemoryEventType): MemoryEntry[] {
	return store.getAll().filter((e) => e.eventType === type);
}

export function bySource(store: MemoryQueryable, source: MemorySource): MemoryEntry[] {
	return store.getAll().filter((e) => e.source === source);
}

export function byRound(store: MemoryQueryable, round: number): MemoryEntry[] {
	return store.getAll().filter((e) => e.round === round);
}

export function hardInfo(store: MemoryQueryable): MemoryEntry[] {
	return store.getAll().filter((e) => e.credibility >= HARD_INFO_THRESHOLD);
}

export function hardInfoAboutPlayer(store: MemoryQueryable, playerId: string): MemoryEntry[] {
	return hardInfo(store).filter((e) => e.actorId === playerId || e.targetId === playerId);
}

export function claimsByPlayer(store: MemoryQueryable, playerId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.actorId === playerId && e.eventType === 'hear_claim');
}

export function accusationsAgainst(store: MemoryQueryable, targetId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.targetId === targetId && e.eventType === 'hear_accuse');
}

export function defensesFor(store: MemoryQueryable, targetId: string): MemoryEntry[] {
	return store.getAll().filter((e) => e.targetId === targetId && e.eventType === 'hear_defend');
}

export function deaths(store: MemoryQueryable): MemoryEntry[] {
	return store.getAll().filter((e) => e.eventType === 'death');
}

export function isDead(store: MemoryQueryable, playerId: string): boolean {
	return deaths(store).some((e) => e.targetId === playerId || e.content.playerId === playerId);
}
