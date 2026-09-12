import type { Card } from '../types'

export type Player = 1 | 2
export type Cell = number | null

export type Move = {
	cardId: number
	position: number
}

export type GameData = {
	cards: readonly Card[]
	cardIds: ReadonlyMap<Card, number>
	cardStats: readonly Card["attributes"][]
}

export type GameState = {
	grid: Cell[]
	owner1: number
	owner2: number
	hand1: number
	hand2: number
	currentPlayer: Player
	moveCount: number
}

const BOARD_SIZE = 9
const CARDS_IN_HAND = 5

export const createGameData = (p1Hand: Card[], p2Hand: Card[]): GameData => {
	const cards = [...new Set([...p1Hand, ...p2Hand])]
	const cardIds = new Map(cards.map((card, cardId) => [card, cardId]))
	return { cards, cardIds, cardStats: cards.map((card) => card.attributes) }
}

export const createGameState = (
	data: GameData,
	p1Hand: Card[],
	p2Hand: Card[],
	currentPlayer: Player = Math.random() < 0.5 ? 1 : 2,
): GameState => ({
	grid: Array<Cell>(BOARD_SIZE).fill(null),
	owner1: 0,
	owner2: 0,
	hand1: getHandMask(data, p1Hand),
	hand2: getHandMask(data, p2Hand),
	currentPlayer,
	moveCount: 0,
})

export const getCard = (data: GameData, cardId: number): Card | null => data.cards[cardId] ?? null

export const getCardsInHand = (data: GameData, state: GameState, player: Player): Card[] => {
	const hand = player === 1 ? state.hand1 : state.hand2
	const cards: Card[] = []
	for (let cardId = 0; cardId < data.cards.length; cardId += 1) {
		if ((hand & (1 << cardId)) !== 0) {
			cards.push(data.cards[cardId])
		}
	}
	return cards
}

export const getLegalMoves = (state: GameState, data: GameData): Move[] => {
	const hand = state.currentPlayer === 1 ? state.hand1 : state.hand2
	const moves: Move[] = []
	for (let cardId = 0; cardId < data.cards.length; cardId += 1) {
		if ((hand & (1 << cardId)) === 0) {
			continue
		}
		for (let position = 0; position < BOARD_SIZE; position += 1) {
			if (state.grid[position] === null) {
				moves.push({ cardId, position })
			}
		}
	}
	return moves
}

export const isLegalMove = (data: GameData, state: GameState, move: Move): boolean => {
	if (move.cardId < 0 || move.cardId >= data.cards.length) {
		return false
	}
	if (move.position < 0 || move.position >= BOARD_SIZE || state.grid[move.position] !== null) {
		return false
	}
	const hand = state.currentPlayer === 1 ? state.hand1 : state.hand2
	return (hand & (1 << move.cardId)) !== 0
}

export const placeCard = (data: GameData, state: GameState, move: Move): GameState | null => {
	if (!isLegalMove(data, state, move)) {
		return null
	}

	const player = state.currentPlayer
	const cardMask = 1 << move.cardId
	const grid = [...state.grid]
	grid[move.position] = move.cardId
	const [owner1, owner2] = getOwnersAfterMove(data, state, grid, move)
	return {
		grid,
		owner1,
		owner2,
		hand1: player === 1 ? state.hand1 & ~cardMask : state.hand1,
		hand2: player === 2 ? state.hand2 & ~cardMask : state.hand2,
		currentPlayer: player === 1 ? 2 : 1,
		moveCount: state.moveCount + 1,
	}
}

export const getOwnersAfterMove = (data: GameData, state: GameState, grid: Cell[], move: Move): [number, number] => {
	const player = state.currentPlayer
	const positionMask = 1 << move.position
	let owner1 = player === 1 ? state.owner1 | positionMask : state.owner1
	let owner2 = player === 2 ? state.owner2 | positionMask : state.owner2

	for (const adjacentPosition of getAdjacentPositions(move.position)) {
		const adjacentCardId = grid[adjacentPosition]
		const opponentMask = player === 1 ? owner2 : owner1
		if (adjacentCardId === null || (opponentMask & (1 << adjacentPosition)) === 0) {
			continue
		}

		const currentValue = getCardAttribute(data.cardStats[move.cardId], move.position, adjacentPosition)
		const adjacentValue = getCardAttribute(data.cardStats[adjacentCardId], adjacentPosition, move.position)
		if (currentValue <= adjacentValue) {
			continue
		}

		const adjacentMask = 1 << adjacentPosition
		if (player === 1) {
			owner1 |= adjacentMask
			owner2 &= ~adjacentMask
		} else {
			owner2 |= adjacentMask
			owner1 &= ~adjacentMask
		}
	}

	return [owner1, owner2]
}

export const getCardAttribute = (attributes: Card["attributes"], cardPos: number, adjacentPos: number): number => {
	if (cardPos - adjacentPos === 3) {
		return attributes.north
	}
	if (cardPos - adjacentPos === -3) {
		return attributes.south
	}
	if (cardPos - adjacentPos === 1) {
		return attributes.west
	}
	if (cardPos - adjacentPos === -1) {
		return attributes.east
	}
	return 0
}

const getAdjacentPositions = (position: number): number[] =>
	[position - 3, position + 3, position % 3 !== 0 ? position - 1 : -1, position % 3 !== 2 ? position + 1 : -1].filter(
		(adjacentPosition) => adjacentPosition >= 0 && adjacentPosition < BOARD_SIZE,
	)

const getHandMask = (data: GameData, hand: Card[]): number =>
	hand.reduce((mask, card) => {
		const cardId = data.cardIds.get(card)
		return cardId === undefined ? mask : mask | (1 << cardId)
	}, 0)

export const generateRandomDeck = (cards: Card[]): Card[] => {
	const shuffledCards = [...cards].sort(() => Math.random() - 0.5)
	return shuffledCards.slice(0, CARDS_IN_HAND)
}

export const drawBoard = (
	entry: HTMLElement,
	data: GameData,
	state: GameState,
	onStateChange: (state: GameState) => void,
): void => {
	entry.innerHTML = ""

	const board = document.createElement("div")
	board.className = "game-board"
	let selectedCardId: number | null = null
	const setSelection = (cardId: number | null): void => {
		selectedCardId = cardId
		board.classList.toggle("has-selection", cardId !== null)
		grid.querySelectorAll(".board-cell").forEach((cell, position) => {
			cell.classList.toggle("available", cardId !== null && state.grid[position] === null)
		})
	}

	const grid = document.createElement("div")
	grid.className = "board-grid"
	for (let position = 0; position < BOARD_SIZE; position += 1) {
		const cell = document.createElement("div")
		cell.className = "board-cell"
		const cardId = state.grid[position]
		if (cardId !== null) {
			const owner = (state.owner1 & (1 << position)) !== 0 ? 1 : 2
			const card = getCard(data, cardId)
			if (card) {
				cell.append(createCardImage(card, owner))
			}
		}
		cell.addEventListener("click", () => {
			if (selectedCardId === null || cardId !== null) {
				return
			}
			onStateChange(placeCard(data, state, { cardId: selectedCardId, position })!)
		})
		cell.addEventListener("dragover", (event) => {
			if (selectedCardId !== null && cardId === null) {
				event.preventDefault()
				cell.classList.add("drag-over")
			}
		})
		cell.addEventListener("dragleave", () => cell.classList.remove("drag-over"))
		cell.addEventListener("drop", (event) => {
			event.preventDefault()
			cell.classList.remove("drag-over")
			if (selectedCardId === null || cardId !== null) {
				return
			}
			onStateChange(placeCard(data, state, { cardId: selectedCardId, position })!)
		})
		grid.append(cell)
	}

	board.append(
		renderHand(getCardsInHand(data, state, 2), 2, state, data, setSelection),
		grid,
		renderHand(getCardsInHand(data, state, 1), 1, state, data, setSelection),
	)
	entry.append(board)
}

const renderHand = (
	cardsInHand: Card[],
	owner: Player,
	state: GameState,
	data: GameData,
	setSelection: (cardId: number | null) => void,
): HTMLDivElement => {
	const hand = document.createElement("div")
	hand.className = `card-hand${owner === state.currentPlayer ? "" : " inactive-hand"}`
	for (const card of cardsInHand) {
		const image = createCardImage(card, owner)
		const cardId = data.cardIds.get(card)
		if (owner === state.currentPlayer && cardId !== undefined) {
			image.draggable = true
			image.addEventListener("click", () => setSelection(cardId))
			image.addEventListener("dragstart", () => setSelection(cardId))
			image.addEventListener("dragend", () => setSelection(null))
		}
		hand.append(image)
	}
	return hand
}

export const createCardImage = (card: Card, owner: Player): HTMLImageElement => {
	const image = document.createElement("img")
	image.className = `card-image player-${owner}`
	image.src = `/assets/cards/${card.imageFilename}`
	image.alt = card.name
	return image
}
