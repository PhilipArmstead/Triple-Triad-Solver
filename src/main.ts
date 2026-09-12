import "./styles.scss"
import { injectCardList } from "./card-list"
import { cards } from "./data/cards"
import { createGameData, createGameState, drawBoard, generateRandomDeck } from "./game/game"

injectCardList(document.querySelector("#card-list") as HTMLElement)

const p1Deck = generateRandomDeck(cards)
const p2Deck = generateRandomDeck(cards)
const data = createGameData(p1Deck, p2Deck)
let state = createGameState(data, p1Deck, p2Deck)
const board = document.querySelector("#board") as HTMLElement
const render = (nextState = state): void => {
	state = nextState
	drawBoard(board, data, state, render)
}

render()
