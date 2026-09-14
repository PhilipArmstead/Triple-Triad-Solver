import { BOARD_SIZE, CARDS_IN_HAND, getLegalMoves, placeCard } from "./game"

/**
 * Deliberately duplicated from game.ts rather than imported: this runs millions of
 * times per search, and the cross-module call measured a consistent ~4% slowdown.
 */
const countBits = (value: number): number => {
	let count = 0
	while (value) {
		value &= value - 1
		count += 1
	}
	return count
}
import type { GameData, GameState, Move } from "./game"

export type OptimalMove = { move: Move | null; score: number }

/**
 * Whether a cached score is the true value of a node, or only a bound on it.
 * A node that pruned never saw all its children, so its score is only a bound
 * and may only be reused when the current window makes that bound decisive.
 */
const EXACT = 0
const LOWER_BOUND = 1
const UPPER_BOUND = 2

type CacheEntry = OptimalMove & { bound: typeof EXACT | typeof LOWER_BOUND | typeof UPPER_BOUND }

type CacheProbe = { hit: CacheEntry | null; alpha: number; beta: number }

/**
 * How much a searched score tells us. A node that never improved on the window
 * it was given only yields a bound, because its children were cut short.
 */
const classifyBound = (score: number, alpha: number, beta: number) =>
	score <= alpha ? UPPER_BOUND : score >= beta ? LOWER_BOUND : EXACT

/**
 * Decides whether a cached entry settles the current node outright, or merely
 * narrows the window it must be searched with. An exact entry always settles it;
 * a bound only does so when it already falls outside the current window.
 */
const probeCache = (cached: CacheEntry | undefined, alpha: number, beta: number): CacheProbe => {
	if (!cached) {
		return { hit: null, alpha, beta }
	}
	if (cached.bound === EXACT) {
		return { hit: cached, alpha, beta }
	}
	if (cached.bound === LOWER_BOUND) {
		return cached.score >= beta
			? { hit: cached, alpha, beta }
			: { hit: null, alpha: Math.max(alpha, cached.score), beta }
	}
	return cached.score <= alpha ? { hit: cached, alpha, beta } : { hit: null, alpha, beta: Math.min(beta, cached.score) }
}

export const getOptimalMove = (state: GameState, data: GameData): OptimalMove => {
	const { move, score } = search(state, data, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, new Map())
	return { move, score }
}

const search = (
	state: GameState,
	data: GameData,
	alpha: number,
	beta: number,
	cache: Map<number, CacheEntry>,
): OptimalMove => {
	if (state.moveCount === BOARD_SIZE) {
		return { move: null, score: getP1Score(state) }
	}

	const key = getStateKey(state)
	const probe = probeCache(cache.get(key), alpha, beta)
	if (probe.hit) {
		return probe.hit
	}
	let nextAlpha = probe.alpha
	let nextBeta = probe.beta

	const maximizing = state.currentPlayer === 1
	const candidates = getOrderedCandidates(state, data)

	let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
	let bestMove: Move | null = null

	for (const candidate of candidates) {
		const { score } = search(candidate.nextState, data, nextAlpha, nextBeta, cache)
		if (maximizing ? score > bestScore : score < bestScore) {
			bestScore = score
			bestMove = candidate.move
		}

		if (maximizing) {
			nextAlpha = Math.max(nextAlpha, bestScore)
		} else {
			nextBeta = Math.min(nextBeta, bestScore)
		}
		if (nextBeta <= nextAlpha) {
			break
		}
	}

	const result: CacheEntry = { move: bestMove, score: bestScore, bound: classifyBound(bestScore, alpha, beta) }
	cache.set(key, result)
	return result
}

/**
 * Exact cache key for a state within a single search.
 *
 * Only the grid contents, player one's ownership and the side to move are
 * encoded. Both hands and the move count are implied by which cards are already
 * on the grid, and player two's ownership is every occupied cell player one does
 * not hold, so including them would be redundant.
 *
 * Each cell holds a card id or an empty marker, giving a base-21 digit that
 * covers the largest possible deck, so the packed key stays a safe integer and
 * distinct states can never collide.
 */
const EMPTY_CELL = 20
const CELL_STATES = EMPTY_CELL + 1

const getStateKey = (state: GameState): number => {
	let key = state.owner1 * 2 + (state.currentPlayer - 1)
	for (let position = 0; position < BOARD_SIZE; position += 1) {
		key = key * CELL_STATES + (state.grid[position] ?? EMPTY_CELL)
	}
	return key
}

const CORNER_POSITIONS = [0, 2, 6, 8]

/**
 * Legal moves paired with their successor state, best first. Priorities are
 * scored from the mover's own perspective, so the strongest candidate is the
 * highest one for both players, and searching it first maximises cutoffs.
 */
const getOrderedCandidates = (
	state: GameState,
	data: GameData,
): { move: Move; nextState: GameState; priority: number }[] =>
	getLegalMoves(state, data)
		.map((move) => {
			const nextState = placeCard(data, state, move)!
			return { move, nextState, priority: getMovePriority(state, nextState, move) }
		})
		.sort((a, b) => b.priority - a.priority)

const getMovePriority = (state: GameState, nextState: GameState, move: Move): number => {
	const ownerBefore = state.currentPlayer === 1 ? state.owner1 : state.owner2
	const ownerAfter = state.currentPlayer === 1 ? nextState.owner1 : nextState.owner2
	// The mover always gains the cell they just played, so discount it to leave
	// only the cards actually flipped from the opponent.
	const captured = countBits(ownerAfter ^ ownerBefore) - 1
	const cornerBonus = CORNER_POSITIONS.includes(move.position) ? 1 : 0
	// The plan also suggests card-strength and centre-control terms. Both were
	// measured here and both made the search slower (strength by ~50%): the
	// terminal score is a pure card count, so neither tracks the true value and
	// they only dilute the capture signal that drives the cutoffs.
	return captured * 100 + cornerBonus
}

/**
 * Final score from player one's perspective: cards owned on the board plus any
 * cards still in hand, which only holds at a terminal node.
 */
const getP1Score = (state: GameState): number => countBits(state.owner1) + countBits(state.hand1) - CARDS_IN_HAND
