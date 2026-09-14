import { describe, expect, it } from "vitest"

import type { Card } from "../types"
import { createGameData, placeCard, type GameState } from "./game"
import { getOptimalMove } from "./minimax"

const card = (name: string, value: number): Card => ({
	name,
	imageFilename: `${name}.png`,
	level: 1,
	attributes: { north: value, south: value, east: value, west: value },
})

const cardWithAttributes = (name: string, attributes: Card["attributes"]): Card => ({
	name,
	imageFilename: `${name}.png`,
	level: 1,
	attributes,
})

const strongCard = card("strong", 9)
const weakCard = card("weak", 1)
const data = createGameData([strongCard], [weakCard])

describe("optimal move search", () => {
	it("returns the final score without a move on a full board", () => {
		const state: GameState = {
			grid: Array(9).fill(0),
			owner1: 0b01111,
			owner2: 0b111100000,
			hand1: 0,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 9,
		}

		expect(getOptimalMove(state, data)).toEqual({ move: null, score: -1 })
	})

	it("returns the only legal move in a nearly complete position", () => {
		const state: GameState = {
			grid: [0, 1, 0, 1, 0, 1, 0, 1, null],
			owner1: 0b01010101,
			owner2: 0b10101010,
			hand1: 1,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 8,
		}

		expect(getOptimalMove(state, data)).toEqual({ move: { cardId: 0, position: 8 }, score: 2 })
	})

	it("counts P1's six cards in the reported real-game position", () => {
		const regressionCards = [
			cardWithAttributes("Turtapod", { north: 2, east: 3, south: 6, west: 7 }),
			cardWithAttributes("Bite Bug", { north: 1, east: 3, south: 3, west: 5 }),
			cardWithAttributes("Imp", { north: 3, east: 7, south: 3, west: 6 }),
			cardWithAttributes("T-Rexaur", { north: 4, east: 6, south: 2, west: 7 }),
			cardWithAttributes("Funguar", { north: 5, east: 1, south: 1, west: 3 }),
			cardWithAttributes("Grendel", { north: 4, east: 4, south: 5, west: 2 }),
			cardWithAttributes("Anacondaur", { north: 5, east: 1, south: 3, west: 5 }),
			cardWithAttributes("Thrustaevis", { north: 5, east: 3, south: 2, west: 5 }),
			cardWithAttributes("Creeps", { north: 5, east: 2, south: 5, west: 2 }),
			cardWithAttributes("Caterchipillar", { north: 4, east: 2, south: 4, west: 3 }),
		]
		const regressionData = createGameData(regressionCards, [])
		const state: GameState = {
			grid: [7, 0, 6, 1, 5, 4, 8, null, 2],
			owner1: 293,
			owner2: 90,
			hand1: 8,
			hand2: 512,
			currentPlayer: 1,
			moveCount: 8,
		}

		expect(getOptimalMove(state, regressionData)).toEqual({ move: { cardId: 3, position: 7 }, score: 1 })
	})

	it("includes P1's remaining hand in the final score", () => {
		const regressionCards = [
			cardWithAttributes("Funguar", { north: 5, east: 1, south: 1, west: 3 }),
			cardWithAttributes("Geezard", { north: 1, east: 4, south: 5, west: 1 }),
			cardWithAttributes("Red Bat", { north: 6, east: 1, south: 1, west: 2 }),
			cardWithAttributes("Abyssal Worm", { north: 7, east: 2, south: 3, west: 5 }),
			cardWithAttributes("Bite Bug", { north: 1, east: 3, south: 3, west: 5 }),
			cardWithAttributes("Tonberry King", { north: 4, east: 6, south: 7, west: 4 }),
			cardWithAttributes("Fastitocalon-F", { north: 3, east: 5, south: 2, west: 1 }),
			cardWithAttributes("Gayla", { north: 2, east: 1, south: 4, west: 4 }),
			cardWithAttributes("Blobra", { north: 2, east: 3, south: 1, west: 5 }),
			cardWithAttributes("Propagator", { north: 8, east: 4, south: 4, west: 8 }),
		]
		const regressionData = createGameData(regressionCards, [])
		const state: GameState = {
			grid: [9, 1, 6, 0, 4, 3, null, 7, 8],
			owner1: 191,
			owner2: 256,
			hand1: 4,
			hand2: 32,
			currentPlayer: 2,
			moveCount: 8,
		}

		const result = getOptimalMove(state, regressionData)
		expect(result).toEqual({ move: { cardId: 5, position: 6 }, score: 1 })

		const finalState = placeCard(regressionData, state, result.move!)
		expect(finalState).toMatchObject({ owner1: 55, owner2: 456 })
	})

	it("chooses a capture that improves player one's final score", () => {
		const cards = [
			strongCard,
			weakCard,
			card("opponent", 1),
			card("board-1", 1),
			card("board-2", 1),
			card("board-3", 1),
			card("board-4", 1),
			card("board-5", 1),
			card("board-6", 1),
		]
		const tacticalData = createGameData(cards, [])
		const state: GameState = {
			grid: [null, null, 3, 4, 5, 6, 7, 8, 9],
			owner1: 0b111111000,
			owner2: 0b000000100,
			hand1: 0b11,
			hand2: 0b100,
			currentPlayer: 1,
			moveCount: 7,
		}

		const result = getOptimalMove(state, tacticalData)
		expect(result.move).toEqual({ cardId: 0, position: 1 })
		expect(result.score).toBeGreaterThan(0)
	})
})
