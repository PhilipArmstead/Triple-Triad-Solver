import type { Card } from "../types"

export type Player = 1 | 2
export type Cell = number | null

export type Move = {
	cardId: number
	position: number
}

export type GameData = {
	cards: readonly Card[]
	cardStats: readonly Card["attributes"][]
	hand1: number
	hand2: number
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

export const BOARD_SIZE = 9
export const CARDS_IN_HAND = 5

/**
 * Card ids are positional: player one holds `0..p1Hand.length - 1` and player two
 * the rest. Ids are deliberately not shared between identical cards, so a hand may
 * hold any combination of the catalogue — five Geezards included — and the two
 * players never collide on a card they happen to both be holding.
 */
export const createGameData = (p1Hand: Card[], p2Hand: Card[]): GameData => {
	const cards = [...p1Hand, ...p2Hand]
	return {
		cards,
		cardStats: cards.map((card) => card.attributes),
		hand1: maskOfRange(0, p1Hand.length),
		hand2: maskOfRange(p1Hand.length, cards.length),
	}
}

/** Bits `[from, to)` set, i.e. the ids of one player's starting hand. */
const maskOfRange = (from: number, to: number): number => {
	let mask = 0
	for (let cardId = from; cardId < to; cardId += 1) {
		mask |= 1 << cardId
	}
	return mask
}

export const createGameState = (data: GameData, currentPlayer: Player = Math.random() < 0.5 ? 1 : 2): GameState => {
	return {
		grid: Array<Cell>(BOARD_SIZE).fill(null),
		owner1: 0,
		owner2: 0,
		hand1: data.hand1,
		hand2: data.hand2,
		currentPlayer,
		moveCount: 0,
	}
}

export const getCard = (data: GameData, cardId: number): Card | null => data.cards[cardId] ?? null

/** The ids still in a player's hand. Ids, not cards, because a hand may hold duplicates. */
export const getCardsInHand = (data: GameData, state: GameState, player: Player): number[] => {
	const hand = player === 1 ? state.hand1 : state.hand2
	const cardIds: number[] = []
	for (let cardId = 0; cardId < data.cards.length; cardId += 1) {
		if ((hand & (1 << cardId)) !== 0) {
			cardIds.push(cardId)
		}
	}
	return cardIds
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

/** `count` distinct cards drawn at random from the catalogue. */
export const generateRandomDeck = (cards: readonly Card[], count = CARDS_IN_HAND): Card[] => {
	const shuffledCards = [...cards].sort(() => Math.random() - 0.5)
	return shuffledCards.slice(0, count)
}

export const countBits = (value: number): number => {
	let count = 0
	while (value) {
		value &= value - 1
		count += 1
	}
	return count
}

/**
 * How many cards a player holds, counting those they own on the board as well as
 * those still in their hand. The two players' counts always sum to the deck size.
 */
export const getCardCount = (state: GameState, player: Player): number =>
	player === 1 ? countBits(state.owner1) + countBits(state.hand1) : countBits(state.owner2) + countBits(state.hand2)

export const isGameOver = (state: GameState): boolean => state.moveCount === BOARD_SIZE

/** The player holding the most cards once the board is full, or null for a draw. */
export const getWinner = (state: GameState): Player | null => {
	const p1Count = getCardCount(state, 1)
	const p2Count = getCardCount(state, 2)
	if (p1Count === p2Count) {
		return null
	}
	return p1Count > p2Count ? 1 : 2
}

/**
 * The nodes applyHint needs to mark up. Handing them back from the draw avoids
 * re-querying the tree, and keeps the hint's knowledge of the markup in one place.
 */
export type BoardView = {
	cells: HTMLElement[]
	activeHandCards: Map<number, HTMLElement>
	hintText: HTMLElement
}

export const drawBoard = (
	entry: HTMLElement,
	data: GameData,
	state: GameState,
	onStateChange: (state: GameState) => void,
): BoardView => {
	entry.innerHTML = ""

	const board = document.createElement("div")
	board.className = "game-board"
	const cells: HTMLElement[] = []
	const activeHandCards = new Map<number, HTMLElement>()
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
		cells.push(cell)
	}

	board.append(
		renderPlayerPanel(2, state, data, setSelection, activeHandCards),
		grid,
		renderPlayerPanel(1, state, data, setSelection, activeHandCards),
	)
	const [status, hintText] = renderStatus(state)
	entry.append(board, status)
	return { cells, activeHandCards, hintText }
}

/** The move the solver recommends, with its score expressed from player one's view. */
export type Hint = {
	move: Move
	score: number
}

/**
 * Marks up an already-drawn board with the solver's recommendation: the target cell,
 * the card to play, the projected final margin and a line of advice in the status bar.
 *
 * The search runs asynchronously, so this annotates the existing DOM rather than
 * redrawing, which would discard a card the player selected while it was running.
 * Call it at most once per drawBoard; each draw starts from a clean board.
 */
export const applyHint = (view: BoardView, data: GameData, state: GameState, hint: Hint | null): void => {
	if (hint === null) {
		return
	}

	// The search scores from player one's perspective, so player two's view is the
	// negation: the board always reads "how far ahead the player to move ends up".
	const score = state.currentPlayer === 1 ? hint.score : -hint.score
	const signed = `${score > 0 ? "+" : ""}${score}`

	const cell = view.cells[hint.move.position]
	cell.classList.add("is-hinted")
	const scoreLabel = document.createElement("span")
	scoreLabel.className = `hint-score${score > 0 ? " is-winning" : ""}${score < 0 ? " is-losing" : ""}`
	scoreLabel.textContent = signed
	cell.append(scoreLabel)

	view.activeHandCards.get(hint.move.cardId)?.classList.add("is-hinted")
	view.hintText.textContent = ` — play ${data.cards[hint.move.cardId].name} here (${signed})`
}

/**
 * A player's name, card count and hand. The panel carries the turn highlight, so
 * whose turn it is reads from the board itself and not just the status line.
 */
const renderPlayerPanel = (
	player: Player,
	state: GameState,
	data: GameData,
	setSelection: (cardId: number | null) => void,
	activeHandCards: Map<number, HTMLElement>,
): HTMLDivElement => {
	const isActive = !isGameOver(state) && state.currentPlayer === player
	const panel = document.createElement("div")
	panel.className = `player-panel player-${player}-panel${isActive ? " is-active" : ""}`

	const header = document.createElement("div")
	header.className = "player-header"
	const cardCount = getCardCount(state, player)
	header.textContent = `Player ${player} (${cardCount} card${cardCount === 1 ? "" : "s"})`

	panel.append(
		header,
		renderHand(getCardsInHand(data, state, player), player, state, data, setSelection, activeHandCards),
	)
	return panel
}

/**
 * Returns the status bar and the empty node the solver's advice lands in. The hint
 * is a separate node so applyHint can fill it without rebuilding the status text.
 */
const renderStatus = (state: GameState): [HTMLDivElement, HTMLSpanElement] => {
	const status = document.createElement("div")
	const hintText = document.createElement("span")
	hintText.className = "hint-text"

	if (isGameOver(state)) {
		const winner = getWinner(state)
		status.className = "game-status is-over"
		status.append(
			winner === null
				? `Draw — ${getCardCount(state, 1)} cards each`
				: `Player ${winner} wins ${getCardCount(state, winner)}–${getCardCount(state, winner === 1 ? 2 : 1)}`,
		)
	} else {
		status.className = `game-status turn-player-${state.currentPlayer}`
		status.append(`Player ${state.currentPlayer}'s turn`)
	}

	status.append(hintText)
	return [status, hintText]
}

const renderHand = (
	cardIds: number[],
	owner: Player,
	state: GameState,
	data: GameData,
	setSelection: (cardId: number | null) => void,
	activeHandCards: Map<number, HTMLElement>,
): HTMLDivElement => {
	const hand = document.createElement("div")
	hand.className = `card-hand${owner === state.currentPlayer && !isGameOver(state) ? "" : " inactive-hand"}`
	for (const cardId of cardIds) {
		const image = createCardImage(data.cards[cardId], owner)
		if (owner === state.currentPlayer) {
			activeHandCards.set(cardId, image)
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
