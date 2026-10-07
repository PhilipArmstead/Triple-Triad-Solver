import { CARDS_IN_HAND, createCardImage, generateRandomDeck, type Player } from "./game/game"
import type { Card } from "./types"

/**
 * The hand each player is assembling. Cards are held as a list rather than a set
 * because a hand may repeat a card any number of times, up to five of a kind.
 */
type Hands = Record<Player, Card[]>

/** A player's half of the builder, plus the hook to refresh it in place. */
type DeckPanel = {
	element: HTMLDivElement
	update: () => void
}

const PLAYERS: Player[] = [1, 2]
const CARD_OPTIONS_ID = "card-options"

/**
 * Draws the pre-game screen and hands back the two decks once the player commits.
 *
 * Cards are chosen by name through a datalist rather than a picture gallery: the
 * catalogue runs to over a hundred cards, far more than fits beside two hands in
 * the board's fixed height.
 */
export const drawDeckBuilder = (
	entry: HTMLElement,
	cards: readonly Card[],
	onStart: (p1Hand: Card[], p2Hand: Card[], firstPlayer: Player | undefined) => void,
): void => {
	const catalogue = sortForCatalogue(cards)
	const byName = new Map(catalogue.map((card) => [card.name, card]))
	const hands: Hands = { 1: [], 2: [] }

	const firstPlayerSelect = document.createElement("select")
	firstPlayerSelect.className = "first-player-select"
	for (const [value, label] of [
		["random", "Random"],
		["1", "Player 1"],
		["2", "Player 2"],
	] as const) {
		const option = document.createElement("option")
		option.value = value
		option.textContent = label
		firstPlayerSelect.append(option)
	}
	firstPlayerSelect.value = "random"

	const firstPlayerControl = document.createElement("label")
	firstPlayerControl.className = "first-player-control"
	firstPlayerControl.append("First to move: ", firstPlayerSelect)

	const startButton = document.createElement("button")
	startButton.className = "new-game start-game"
	startButton.type = "button"
	startButton.textContent = "Start game"
	startButton.addEventListener("click", () => {
		let firstPlayer: Player | undefined
		if (firstPlayerSelect.value === "1") {
			firstPlayer = 1
		} else if (firstPlayerSelect.value === "2") {
			firstPlayer = 2
		}
		onStart(hands[1], hands[2], firstPlayer)
	})

	// Panels are built once and refreshed in place. Rebuilding them would replace the
	// card fields on every pick, so a player naming five cards in a row would lose
	// focus after each one.
	const refresh = (): void => {
		for (const panel of panels) {
			panel.update()
		}
		startButton.disabled = !PLAYERS.every((player) => hands[player].length === CARDS_IN_HAND)
	}
	const panels = PLAYERS.map((player) => createDeckPanel(player, hands, byName, cards, refresh))

	const builder = document.createElement("div")
	builder.className = "deck-builder"
	builder.append(renderDatalist(catalogue), ...panels.map((panel) => panel.element))

	const footer = document.createElement("div")
	footer.className = "builder-footer"
	footer.append(firstPlayerControl, startButton)

	refresh()
	entry.innerHTML = ""
	entry.append(builder, footer)
}

/** Level first, then name, so the list reads in the order the cards are earned. */
const sortForCatalogue = (cards: readonly Card[]): Card[] =>
	[...cards].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))

const renderDatalist = (catalogue: readonly Card[]): HTMLDataListElement => {
	const datalist = document.createElement("datalist")
	datalist.id = CARD_OPTIONS_ID
	for (const card of catalogue) {
		const option = document.createElement("option")
		option.value = card.name
		option.label = card.name
		datalist.append(option)
	}
	return datalist
}

const createDeckPanel = (
	player: Player,
	hands: Hands,
	byName: ReadonlyMap<string, Card>,
	cards: readonly Card[],
	refresh: () => void,
): DeckPanel => {
	const hand = hands[player]

	const element = document.createElement("div")
	element.className = `player-panel player-${player}-panel builder-panel`

	const header = document.createElement("div")
	header.className = "player-header"

	const slots = document.createElement("div")
	slots.className = "builder-slots"

	const input = document.createElement("input")
	input.className = "card-search"
	input.type = "text"
	input.setAttribute("list", CARD_OPTIONS_ID)
	input.setAttribute("aria-label", `Add a card to player ${player}'s hand`)
	// Choosing from a datalist fires input, not change, so the name lands in the hand
	// as soon as it completes rather than waiting for the field to lose focus.
	input.addEventListener("input", () => {
		const card = byName.get(input.value.trim())
		if (!card || hand.length === CARDS_IN_HAND) {
			return
		}
		hand.push(card)
		input.value = ""
		refresh()
	})

	const fillButton = document.createElement("button")
	fillButton.className = "new-game fill-hand"
	fillButton.type = "button"
	fillButton.textContent = "Fill randomly"
	fillButton.addEventListener("click", () => {
		hand.push(...generateRandomDeck(cards, CARDS_IN_HAND - hand.length))
		refresh()
	})

	const controls = document.createElement("div")
	controls.className = "builder-controls"
	controls.append(input, fillButton)
	element.append(header, slots, controls)

	const update = (): void => {
		const isFull = hand.length === CARDS_IN_HAND
		header.textContent = `Player ${player} (${hand.length}/${CARDS_IN_HAND})`
		input.disabled = isFull
		input.placeholder = isFull ? "Hand complete" : "Add a card by name…"
		fillButton.disabled = isFull
		drawSlots(slots, hand, player, refresh)
	}

	return { element, update }
}

/** Five slots, filled left to right. Clicking a chosen card takes it back out. */
const drawSlots = (slots: HTMLElement, hand: Card[], player: Player, refresh: () => void): void => {
	slots.innerHTML = ""
	for (let index = 0; index < CARDS_IN_HAND; index += 1) {
		const slot = document.createElement("div")
		slot.className = "builder-slot"
		const card = hand[index]
		if (card) {
			slot.className += " is-filled"
			slot.title = `Remove ${card.name}`
			slot.append(createCardImage(card, player))
			slot.addEventListener("click", () => {
				hand.splice(index, 1)
				refresh()
			})
		}
		slots.append(slot)
	}
}
