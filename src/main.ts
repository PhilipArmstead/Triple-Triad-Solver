import "./styles.scss"
import { cards } from "./data/cards"
import { createGameData, createGameState, drawBoard, generateRandomDeck } from "./game/game"
import { getOptimalMove } from "./game/minimax"

const p1Deck = generateRandomDeck(cards)
const p2Deck = generateRandomDeck(cards)
const data = createGameData(p1Deck, p2Deck)
let state = createGameState(data, p1Deck, p2Deck)
const board = document.querySelector("#board") as HTMLElement

const render = (nextState = state): void => {
	state = nextState
	drawBoard(board, data, state, render)
	if (state.moveCount < 9) {
		setTimeout(
			() => {
				const start = performance.now()
				const { move, score } = getOptimalMove(state, data)
				const end = performance.now()
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
}

render()
