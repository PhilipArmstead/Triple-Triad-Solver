import { afterEach, describe, expect, it, vi } from "vitest"

import { FakeElement } from "../test-utils/fake-element"
import type { Card } from "../types"
import {
	applyHint,
	createCardImage,
	createGameData,
	createGameState,
	drawBoard,
	getCard,
	getCardAttribute,
	getCardCount,
	getCardsInHand,
	getLegalMoves,
	getOwnersAfterMove,
	getWinner,
	isGameOver,
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

const HAS_SELECTION = "has-selection"

const strongCard = card("strong", 9)
const weakCard = card("weak", 1)
const data = createGameData([strongCard], [weakCard])

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe("game state", () => {
	it("uses masks for hands and ownership", () => {
		const state = createGameState(data, 2)

		expect(state.grid).toEqual(Array(9).fill(null))
		expect(state.hand1).toBe(1)
		expect(state.hand2).toBe(2)
		expect(getCardsInHand(data, state, 1)).toEqual([0])
		expect(getCardsInHand(data, state, 2)).toEqual([1])
	})

	it("gives repeated cards their own id so a hand may hold duplicates", () => {
		const fiveOfAKind = createGameData([strongCard, strongCard, strongCard], [strongCard, strongCard])
		const state = createGameState(fiveOfAKind, 1)

		expect(fiveOfAKind.cards).toHaveLength(5)
		expect(state.hand1).toBe(0b00111)
		expect(state.hand2).toBe(0b11000)
		expect(getCardsInHand(fiveOfAKind, state, 1)).toEqual([0, 1, 2])
	})

	it("keeps hands apart when both players hold the same card", () => {
		const shared = createGameData([strongCard], [strongCard])

		expect(shared.hand1 & shared.hand2).toBe(0)
	})

	it("generates legal moves from the active hand mask", () => {
		const state = createGameState(data, 1)
		const moves = getLegalMoves(state, data)

		expect(moves).toHaveLength(9)
		expect(moves[0]).toEqual({ cardId: 0, position: 0 })
		expect(getLegalMoves({ ...state, currentPlayer: 2 }, data)).toHaveLength(9)
	})

	it("validates and applies moves without mutating the source state", () => {
		const state = createGameState(data, 1)
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
		const p1State = createGameState(data, 1)
		const p1Grid: GameState["grid"] = [null, 1, null, null, null, null, null, null, null]
		expect(
			getOwnersAfterMove(data, { ...p1State, owner2: 1 << 1 }, [0, 1, null, null, null, null, null, null, null], {
				cardId: 0,
				position: 0,
			}),
		).toEqual([3, 0])

		const p2State = createGameState(data, 2)
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

	it("counts owned cards on the board and in hand, and reports the result", () => {
		const state: GameState = {
			grid: [0, 1, 0, 1, 0, 1, 0, 1, null],
			owner1: 0b01010101,
			owner2: 0b10101010,
			hand1: 0b1,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 8,
		}

		expect(getCardCount(state, 1)).toBe(5)
		expect(getCardCount(state, 2)).toBe(4)
		expect(isGameOver(state)).toBe(false)
		expect(getWinner(state)).toBe(1)

		expect(isGameOver({ ...state, moveCount: 9 })).toBe(true)
		expect(getWinner({ ...state, hand1: 0 })).toBeNull()
		expect(getWinner({ ...state, hand1: 0, owner1: 0b00010101 })).toBe(2)
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
		drawBoard(entry as unknown as HTMLElement, data, createGameState(data, 1), onStateChange)
		const board = entry.children[0]
		const grid = board.children[1]
		const p1Panel = board.children[2]
		const p1Hand = p1Panel.children[1]
		const cell = grid.children[0]

		p1Hand.children[0].dispatch("click")
		expect(board.className).toContain(HAS_SELECTION)
		cell.dispatch("dragover", { preventDefault: vi.fn() } as unknown as Event)
		cell.dispatch("drop", { preventDefault: vi.fn() } as unknown as Event)
		expect(onStateChange).toHaveBeenCalledOnce()
	})

	it("labels each player with their card count and marks the active one", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, createGameState(data, 1), vi.fn())
		const board = entry.children[0]
		const [p2Panel, , p1Panel] = board.children

		expect(p2Panel.children[0].textContent).toBe("Player 2 (1 card)")
		expect(p1Panel.children[0].textContent).toBe("Player 1 (1 card)")
		expect(p1Panel.className).toContain("is-active")
		expect(p2Panel.className).not.toContain("is-active")
		expect(p2Panel.children[1].className).toContain("inactive-hand")
	})

	it("announces whose turn it is while the game is running", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, createGameState(data, 2), vi.fn())
		const status = entry.children[1]

		expect(status.className).toBe("game-status turn-player-2")
		expect(status.textContent).toBe("Player 2's turn")
	})

	it("announces the winner once the board is full", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const state: GameState = {
			grid: Array(9).fill(0),
			owner1: 0b111111,
			owner2: 0b111000000,
			hand1: 0,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 9,
		}
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		expect(entry.children[1].className).toBe("game-status is-over")
		expect(entry.children[1].textContent).toBe("Player 1 wins 6–3")
		expect(entry.children[0].children[2].className).not.toContain("is-active")
	})

	it("announces a draw when neither player leads", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const state: GameState = {
			grid: Array(9).fill(0),
			owner1: 0b1111,
			owner2: 0b111110000,
			hand1: 0b1,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 9,
		}
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		expect(entry.children[1].textContent).toBe("Draw — 5 cards each")
	})
})

describe("optimal move hint", () => {
	const hintedState = (currentPlayer: 1 | 2): GameState => createGameState(data, currentPlayer)

	it("marks the target cell and card, and reads the score from player one's view", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		const state = hintedState(1)
		const view = drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		applyHint(view, data, state, { move: { cardId: 0, position: 4 }, score: 2 })

		const cell = view.cells[4] as unknown as FakeElement
		expect(cell.className).toContain("is-hinted")
		expect(cell.children[0].className).toBe("hint-score is-winning")
		expect(cell.children[0].textContent).toBe("+2")
		expect((view.activeHandCards.get(0) as unknown as FakeElement).className).toContain("is-hinted")
		expect(view.hintText.textContent).toBe(" — play strong here (+2)")
		expect(view.cells[0].className).not.toContain("is-hinted")
	})

	it("negates the score for player two so it always favours the player to move", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		const state = hintedState(2)
		const view = drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		applyHint(view, data, state, { move: { cardId: 1, position: 0 }, score: 3 })

		const cell = view.cells[0] as unknown as FakeElement
		expect(cell.children[0].className).toBe("hint-score is-losing")
		expect(cell.children[0].textContent).toBe("-3")
		expect(view.hintText.textContent).toBe(" — play weak here (-3)")
	})

	it("does nothing without a suggestion, and tolerates a card outside the active hand", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		const state = hintedState(1)
		const view = drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		applyHint(view, data, state, null)
		expect(view.hintText.textContent).toBe("")
		expect(view.cells.every((cell) => !cell.className.includes("is-hinted"))).toBe(true)

		applyHint(view, data, state, { move: { cardId: 1, position: 8 }, score: 0 })
		expect(view.cells[8].className).toContain("is-hinted")
		const drawLabel = (view.cells[8] as unknown as FakeElement).children[0]
		expect(drawLabel.textContent).toBe("0")
		expect(drawLabel.className).toBe("hint-score")
	})
})

describe("unknown cards", () => {
	it("returns null for a card id the data does not hold", () => {
		expect(getCard(data, 99)).toBeNull()
	})

	it("draws a cell whose card is missing from the data as empty", () => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const state: GameState = {
			grid: [99, null, null, null, null, null, null, null, null],
			owner1: 0b1,
			owner2: 0,
			hand1: 0b10,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 1,
		}
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		expect(entry.children[0].children[1].children[0].children).toHaveLength(0)
	})
})

describe("starting player", () => {
	it("tosses a coin when no player is given", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.49)
		expect(createGameState(data).currentPlayer).toBe(1)

		vi.spyOn(Math, "random").mockReturnValue(0.5)
		expect(createGameState(data).currentPlayer).toBe(2)
	})
})

describe("board interaction", () => {
	/** A board with the strong card already played, so cell 0 is occupied and cell 1 is free. */
	const startedState: GameState = {
		grid: [0, null, null, null, null, null, null, null, null],
		owner1: 0b1,
		owner2: 0,
		hand1: 0b10,
		hand2: 0,
		currentPlayer: 1,
		moveCount: 1,
	}

	const draw = (state: GameState) => {
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		const onStateChange = vi.fn()
		drawBoard(entry as unknown as HTMLElement, data, state, onStateChange)
		const board = entry.children[0]
		return { onStateChange, board, grid: board.children[1], hand: board.children[2].children[1] }
	}

	it("plays the selected card into a clicked cell", () => {
		const { onStateChange, grid, hand } = draw(startedState)

		hand.children[0].dispatch("click")
		grid.children[1].dispatch("click")

		expect(onStateChange).toHaveBeenCalledOnce()
		expect(onStateChange.mock.calls[0]![0]).toMatchObject({ moveCount: 2, currentPlayer: 2 })
	})

	it("ignores interaction with a cell that already holds a card", () => {
		const { onStateChange, grid, hand } = draw(startedState)
		const preventDefault = vi.fn()

		hand.children[0].dispatch("click")
		grid.children[0].dispatch("click")
		grid.children[0].dispatch("dragover", { preventDefault } as unknown as Event)
		grid.children[0].dispatch("drop", { preventDefault } as unknown as Event)

		expect(onStateChange).not.toHaveBeenCalled()
		expect(preventDefault).toHaveBeenCalledOnce()
		expect(grid.children[0].className).not.toContain("drag-over")
	})

	it("ignores interaction while no card is selected", () => {
		const { onStateChange, grid } = draw(startedState)
		const preventDefault = vi.fn()

		grid.children[1].dispatch("click")
		grid.children[1].dispatch("dragover", { preventDefault } as unknown as Event)
		grid.children[1].dispatch("drop", { preventDefault } as unknown as Event)

		expect(onStateChange).not.toHaveBeenCalled()
		expect(preventDefault).toHaveBeenCalledOnce()
	})

	it("highlights a cell on drag over and clears it again on drag leave", () => {
		const { grid, hand } = draw(startedState)

		hand.children[0].dispatch("click")
		grid.children[1].dispatch("dragover", { preventDefault: vi.fn() } as unknown as Event)
		expect(grid.children[1].className).toContain("drag-over")

		grid.children[1].dispatch("dragleave")
		expect(grid.children[1].className).not.toContain("drag-over")
	})

	it("selects a card on drag start and clears the selection on drag end", () => {
		const { board, grid, hand } = draw(startedState)

		hand.children[0].dispatch("dragstart")
		expect(board.className).toContain(HAS_SELECTION)
		expect(grid.children[1].className).toContain("available")
		expect(grid.children[0].className).not.toContain("available")

		hand.children[0].dispatch("dragend")
		expect(board.className).not.toContain(HAS_SELECTION)
		expect(grid.children[1].className).not.toContain("available")
	})

	it("announces a player two win", () => {
		const state: GameState = {
			grid: Array(9).fill(0),
			owner1: 0b111,
			owner2: 0b111111000,
			hand1: 0,
			hand2: 0,
			currentPlayer: 1,
			moveCount: 9,
		}
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		drawBoard(entry as unknown as HTMLElement, data, state, vi.fn())

		expect(entry.children[1].textContent).toBe("Player 2 wins 6–3")
	})
})
