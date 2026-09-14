import "./styles.scss"
import { cards } from "./data/cards"
import { drawDeckBuilder } from "./deck-builder"
import { applyHint, createGameData, createGameState, drawBoard, isGameOver } from "./game/game"
import type { GameData, GameState } from "./game/game"
import { getOptimalMove } from "./game/minimax"
import type { Card } from "./types"

const board = document.querySelector("#board") as HTMLElement
const newGameButton = document.querySelector("#new-game") as HTMLButtonElement

let data: GameData
let state: GameState
// Bumped on every new game so a solve scheduled for an abandoned game is dropped
// rather than logged against the board that replaced it.
let generation = 0

const render = (nextState = state): void => {
	state = nextState
	const view = drawBoard(board, data, state, render)
	if (isGameOver(state)) {
		return
	}

	const solveFor = generation
	setTimeout(
		() => {
			if (solveFor !== generation) {
				return
			}
			const start = performance.now()
			const { move, score } = getOptimalMove(state, data)
			const end = performance.now()
			applyHint(view, data, state, { move: move!, score })
			console.log(
				`Optimal move for %cPlayer ${state.currentPlayer}%c: %c${data.cards[move!.cardId].name}%c to position %c${move!.position}%c. Expected score: %c${score > 0 ? "+" : ""}${score}%c. (calculated in ${Math.round(end - start)} ms)`,
				`color: ${state.currentPlayer === 1 ? "#0f0" : "#f00"}; font-weight: bold;`,
				"",
				"color: #0ff; font-weight: bold;",
				"",
				"color: #ff0",
				"",
				`color: ${score > 0 ? "#0f0" : "#f00"}; font-weight: bold;`,
				"",
			)
		},
		state.moveCount === 0 ? 100 : 0,
	)
}

/** Sends the player back to the deck builder; the game starts once they commit. */
const startNewGame = (): void => {
	generation += 1
	drawDeckBuilder(board, cards, startGame)
}

const startGame = (p1Hand: Card[], p2Hand: Card[]): void => {
	data = createGameData(p1Hand, p2Hand)
	render(createGameState(data))
}

newGameButton.addEventListener("click", startNewGame)
startNewGame()
