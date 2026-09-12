import { afterEach, describe, expect, it, vi } from "vitest"

import type { Card } from "../types"
import {
	createCardImage,
	createGameData,
	createGameState,
	drawBoard,
	getCardAttribute,
	getCardsInHand,
	getLegalMoves,
	getOwnersAfterMove,
	isLegalMove,
	placeCard,
	type GameState,
} from "./game"

const card = (name: string, value: number): Card => ({
	name,
	imageFilename: `${name}.png`,
	level: 1,
	attributes: { north: value, south: value, east: value, west: value },
})

const strongCard = card("strong", 9)
const weakCard = card("weak", 1)
const data = createGameData([strongCard], [weakCard])

class FakeElement {
	innerHTML = ""
	className = ""
	children: FakeElement[] = []
	listeners = new Map<string, (event: Event) => void>()
	classList = {
		add: (name: string) => {
			this.className += ` ${name}`
		},
		remove: (name: string) => {
			this.className = this.className.replace(` ${name}`, "")
		},
		toggle: (name: string, enabled: boolean) => (enabled ? this.classList.add(name) : this.classList.remove(name)),
	}

	addEventListener(name: string, listener: EventListener): void {
		this.listeners.set(name, listener as (event: Event) => void)
	}

	append(...elements: FakeElement[]): void {
		this.children.push(...elements)
	}

	dispatch(name: string, event = {} as Event): void {
		this.listeners.get(name)?.(event)
	}

	querySelectorAll<T extends FakeElement>(): T[] {
		return this.children as T[]
	}
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe("game state", () => {
	it("uses masks for hands and ownership", () => {
		const state = createGameState(data, [strongCard], [weakCard], 2)

		expect(state.grid).toEqual(Array(9).fill(null))
		expect(state.hand1).toBe(1)
		expect(state.hand2).toBe(2)
		expect(getCardsInHand(data, state, 1)).toEqual([strongCard])
		expect(getCardsInHand(data, state, 2)).toEqual([weakCard])
	})

	it("generates legal moves from the active hand mask", () => {
		const state = createGameState(data, [strongCard], [weakCard], 1)
		const moves = getLegalMoves(state, data)

		expect(moves).toHaveLength(9)
		expect(moves[0]).toEqual({ cardId: 0, position: 0 })
		expect(getLegalMoves({ ...state, currentPlayer: 2 }, data)).toHaveLength(9)
	})

	it("validates and applies moves without mutating the source state", () => {
		const state = createGameState(data, [strongCard], [weakCard], 1)
		const move = { cardId: 0, position: 0 }

		expect(isLegalMove(data, state, move)).toBe(true)
		expect(isLegalMove(data, state, { cardId: 2, position: 0 })).toBe(false)
		expect(isLegalMove(data, state, { cardId: 0, position: -1 })).toBe(false)
		expect(placeCard(data, state, { cardId: 0, position: -1 })).toBeNull()

		const nextState = placeCard(data, state, move)
		expect(nextState).toEqual({
			grid: [0, null, null, null, null, null, null, null, null],
			owner1: 1,
			owner2: 0,
			hand1: 0,
			hand2: 2,
			currentPlayer: 2,
			moveCount: 1,
		})
		expect(state.grid[0]).toBeNull()
	})

	it("captures adjacent cards for both players", () => {
		const p1State = createGameState(data, [strongCard], [weakCard], 1)
		const p1Grid: GameState["grid"] = [null, 1, null, null, null, null, null, null, null]
		expect(
			getOwnersAfterMove(data, { ...p1State, owner2: 1 << 1 }, [0, 1, null, null, null, null, null, null, null], {
				cardId: 0,
				position: 0,
			}),
		).toEqual([3, 0])

		const p2State = createGameState(data, [weakCard], [strongCard], 2)
		expect(
			getOwnersAfterMove(data, { ...p2State, owner1: 1 << 3 }, [0, null, null, 1, null, null, null, null, null], {
				cardId: 0,
				position: 0,
			}),
		).toEqual([0, 9])
		expect(getOwnersAfterMove(data, { ...p1State, owner2: 1 << 1 }, p1Grid, { cardId: 1, position: 0 })).toEqual([1, 2])
	})

	it("reads each card direction", () => {
		const attributes = { north: 1, south: 2, east: 3, west: 4 }
		expect(getCardAttribute(attributes, 3, 0)).toBe(1)
		expect(getCardAttribute(attributes, 0, 3)).toBe(2)
		expect(getCardAttribute(attributes, 1, 0)).toBe(4)
		expect(getCardAttribute(attributes, 0, 1)).toBe(3)
		expect(getCardAttribute(attributes, 0, 8)).toBe(0)
	})
})

describe("board rendering", () => {
	it("creates card images and handles card selection", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const image = createCardImage(strongCard, 1) as unknown as FakeElement & { src: string; alt: string }
		expect(image.className).toBe("card-image player-1")
		expect(image.src).toBe("/assets/cards/strong.png")
		expect(image.alt).toBe("strong")

		const entry = new FakeElement()
		const onStateChange = vi.fn()
		drawBoard(entry as unknown as HTMLElement, data, createGameState(data, [strongCard], [weakCard], 1), onStateChange)
		const board = entry.children[0]
		const grid = board.children[1]
		const p1Hand = board.children[2]
		const cell = grid.children[0]

		p1Hand.children[0].dispatch("click")
		expect(board.className).toContain("has-selection")
		cell.dispatch("dragover", { preventDefault: vi.fn() } as unknown as Event)
		cell.dispatch("drop", { preventDefault: vi.fn() } as unknown as Event)
		expect(onStateChange).toHaveBeenCalledOnce()
	})
})
