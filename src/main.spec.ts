import { afterEach, describe, expect, it, vi } from "vitest"

import type { GameData, GameState, Move } from "./game/game"
import { FakeElement } from "./test-utils/fake-element"

/**
 * main.ts wires the renderer to the solver and runs on import, so the solver is
 * replaced with a stub and drawBoard is wrapped to capture the render callback the
 * app hands it. Everything else — the game rules, the real rendering, the hint — runs
 * for real, so these tests cover the wiring rather than a mock of it.
 */
const mocks = vi.hoisted(() => ({
	getOptimalMove: vi.fn(),
	draws: [] as {
		data: GameData
		state: GameState
		view: { cells: HTMLElement[]; hintText: HTMLElement }
		rerender: (state: GameState) => void
	}[],
}))

vi.mock("./game/minimax", () => ({ getOptimalMove: mocks.getOptimalMove }))

vi.mock("./game/game", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./game/game")>()
	return {
		...actual,
		drawBoard: (entry: HTMLElement, data: GameData, state: GameState, onStateChange: (state: GameState) => void) => {
			const view = actual.drawBoard(entry, data, state, onStateChange)
			mocks.draws.push({ data, state, view, rerender: onStateChange })
			return view
		},
	}
})

const hint = (move: Move, score: number) => ({ move, score })

const loadApp = async (optimal: { move: Move; score: number }) => {
	const newGameButton = new FakeElement()
	const log = vi.fn()
	mocks.draws.length = 0
	mocks.getOptimalMove.mockReset().mockReturnValue(optimal)
	// Pins the shuffled decks and the coin toss for who opens, so the assertions below
	// describe one fixed game rather than whichever one the app happened to deal.
	vi.spyOn(Math, "random").mockReturnValue(0)
	vi.stubGlobal("document", {
		createElement: () => new FakeElement(),
		querySelector: (selector: string) => (selector === "#board" ? new FakeElement() : newGameButton),
	})
	vi.stubGlobal("performance", { now: () => 0 })
	vi.stubGlobal("console", { log })
	vi.useFakeTimers()
	vi.resetModules()
	await import("./main")

	const latest = () => mocks.draws[mocks.draws.length - 1]!
	return { log, newGameButton, latest }
}

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe("app entry", () => {
	it("deals a fresh game and solves it after the opening delay", async () => {
		const { log, latest } = await loadApp(hint({ cardId: 0, position: 4 }, 2))

		expect(mocks.draws).toHaveLength(1)
		expect(latest().state.moveCount).toBe(0)
		expect(latest().state.currentPlayer).toBe(1)

		// The opening solve is deferred so the board paints before the search blocks.
		vi.advanceTimersByTime(99)
		expect(mocks.getOptimalMove).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(mocks.getOptimalMove).toHaveBeenCalledWith(latest().state, latest().data)
		expect(log).toHaveBeenCalledTimes(1)
		const [message, playerColour] = log.mock.calls[0]!
		expect(message).toContain("Optimal move for %cPlayer 1")
		expect(message).toContain(`%c${latest().data.cards[0].name}%c to position %c4%c`)
		expect(message).toContain("Expected score: %c+2%c")
		expect(playerColour).toBe("color: #0f0; font-weight: bold;")
	})

	it("annotates the board with the solver's recommendation", async () => {
		const { latest } = await loadApp(hint({ cardId: 0, position: 4 }, 2))
		vi.advanceTimersByTime(100)

		const { view, data } = latest()
		expect(view.cells[4]!.className).toContain("is-hinted")
		expect(view.hintText.textContent).toBe(` — play ${data.cards[0].name} here (+2)`)
	})

	it("skips the solve once the board is full", async () => {
		const { log, latest } = await loadApp(hint({ cardId: 0, position: 4 }, 2))
		vi.advanceTimersByTime(100)
		log.mockClear()
		mocks.getOptimalMove.mockClear()

		latest().rerender({ ...latest().state, moveCount: 9 })
		vi.advanceTimersByTime(100)

		expect(mocks.draws).toHaveLength(2)
		expect(mocks.getOptimalMove).not.toHaveBeenCalled()
		expect(log).not.toHaveBeenCalled()
	})

	it("solves later moves immediately and reads negative scores from player two's view", async () => {
		const { log, latest } = await loadApp(hint({ cardId: 1, position: 7 }, -3))
		vi.advanceTimersByTime(100)
		log.mockClear()

		latest().rerender({ ...latest().state, currentPlayer: 2, moveCount: 1 })
		// No opening delay once the game is under way.
		vi.advanceTimersByTime(0)

		expect(log).toHaveBeenCalledTimes(1)
		const [message, playerColour, , , , , , scoreColour] = log.mock.calls[0]!
		expect(message).toContain("Optimal move for %cPlayer 2")
		expect(message).toContain("Expected score: %c-3%c")
		expect(playerColour).toBe("color: #f00; font-weight: bold;")
		expect(scoreColour).toBe("color: #f00; font-weight: bold;")
	})

	it("reuses the current state when re-rendered without one", async () => {
		const { latest } = await loadApp(hint({ cardId: 0, position: 4 }, 2))
		const before = latest().state

		;(latest().rerender as () => void)()

		expect(mocks.draws).toHaveLength(2)
		expect(latest().state).toBe(before)
	})

	it("drops a solve scheduled for a game the player has abandoned", async () => {
		const { log, newGameButton, latest } = await loadApp(hint({ cardId: 0, position: 4 }, 2))
		const abandoned = latest().state

		newGameButton.dispatch("click")
		expect(mocks.draws).toHaveLength(2)
		expect(latest().state).not.toBe(abandoned)

		// Both games scheduled a solve; only the current one should run.
		vi.advanceTimersByTime(100)
		expect(mocks.getOptimalMove).toHaveBeenCalledTimes(1)
		expect(mocks.getOptimalMove).toHaveBeenCalledWith(latest().state, latest().data)
		expect(log).toHaveBeenCalledTimes(1)
	})
})
