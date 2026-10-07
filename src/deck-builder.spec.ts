import { afterEach, describe, expect, it, vi } from "vitest"

import { drawDeckBuilder } from "./deck-builder"
import { FakeElement } from "./test-utils/fake-element"
import type { Card } from "./types"

const card = (name: string, level: number): Card => ({
	name,
	imageFilename: `${name}.png`,
	level,
	attributes: { north: 1, south: 1, east: 1, west: 1 },
})

// Deliberately out of order, so the catalogue's sort has something to do.
const catalogue = [card("Zell", 10), card("Geezard", 1), card("Ifrit", 4), card("Bite Bug", 1), card("Angelo", 4)]

const CARD_OPTIONS = "card-options"

/** The header each panel is expected to show for a hand of the given size. */
const handLabel = (player: 1 | 2, count: number) => `Player ${player} (${count}/5)`

/** Navigates the builder's markup, which the tests drive in place of a real DOM. */
const builderOf = (entry: FakeElement) => {
	const builder = entry.children[0]
	const panel = (player: 1 | 2) => builder.children[player]
	const controls = (player: 1 | 2) => panel(player).children[2]
	return {
		datalist: builder.children[0],
		header: (player: 1 | 2) => panel(player).children[0],
		slots: (player: 1 | 2) => panel(player).children[1].children,
		input: (player: 1 | 2) => controls(player).children[0],
		fillButton: (player: 1 | 2) => controls(player).children[1],
		firstPlayerSelect: entry.children[1].children[0].children[0],
		startButton: entry.children[1].children[1],
	}
}

/** Picks a card by name the way the datalist does: set the value, fire input. */
const chooseCard = (input: FakeElement, name: string): void => {
	input.value = name
	input.dispatch("input")
}

const draw = (onStart = vi.fn()) => {
	vi.stubGlobal("document", { createElement: () => new FakeElement() })
	const entry = new FakeElement()
	drawDeckBuilder(entry as unknown as HTMLElement, catalogue, onStart)
	return { entry, onStart, ui: builderOf(entry) }
}

const fillBoth = (ui: ReturnType<typeof builderOf>): void => {
	ui.fillButton(1).dispatch("click")
	ui.fillButton(2).dispatch("click")
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe("deck builder", () => {
	it("offers every card, ordered by level then name", () => {
		const { ui } = draw()

		expect(ui.datalist.id).toBe(CARD_OPTIONS)
		expect(ui.datalist.children.map((option) => option.value)).toEqual([
			"Bite Bug",
			"Geezard",
			"Angelo",
			"Ifrit",
			"Zell",
		])
		expect(ui.datalist.children.map((option) => option.label)).toEqual([
			"Bite Bug",
			"Geezard",
			"Angelo",
			"Ifrit",
			"Zell",
		])
	})

	it("starts both hands empty, with the game not yet playable", () => {
		const { ui } = draw()

		expect(ui.header(1).textContent).toBe(handLabel(1, 0))
		expect(ui.header(2).textContent).toBe(handLabel(2, 0))
		expect(ui.slots(1)).toHaveLength(5)
		expect(ui.slots(1).every((slot) => slot.className === "builder-slot")).toBe(true)
		expect(ui.startButton.disabled).toBe(true)
	})

	it("offers a random first player by default or lets the user choose one", () => {
		const { ui } = draw()

		expect(ui.firstPlayerSelect.value).toBe("random")
		expect(ui.firstPlayerSelect.children.map((option) => [option.value, option.textContent])).toEqual([
			["random", "Random"],
			["1", "Player 1"],
			["2", "Player 2"],
		])
	})

	it("points each field at the shared list of card names", () => {
		const { ui } = draw()

		expect(ui.input(1).attributes.get("list")).toBe(CARD_OPTIONS)
		expect(ui.input(2).attributes.get("list")).toBe(CARD_OPTIONS)
		expect(ui.input(2).attributes.get("aria-label")).toBe("Add a card to player 2's hand")
	})

	it("adds a named card to that player's hand alone and clears the field", () => {
		const { ui } = draw()

		chooseCard(ui.input(1), "Ifrit")

		expect(ui.header(1).textContent).toBe(handLabel(1, 1))
		expect(ui.header(2).textContent).toBe(handLabel(2, 0))
		expect(ui.input(1).value).toBe("")
		expect(ui.slots(1)[0].className).toContain("is-filled")
		expect(ui.slots(1)[0].title).toBe("Remove Ifrit")
		expect(ui.slots(1)[0].children[0].className).toBe("card-image player-1")
	})

	it("accepts the same card five times over", () => {
		const { ui, onStart } = draw()

		for (let index = 0; index < 5; index += 1) {
			chooseCard(ui.input(1), "Geezard")
		}
		ui.fillButton(2).dispatch("click")
		ui.startButton.dispatch("click")

		const [p1Hand] = onStart.mock.calls[0]!
		expect(p1Hand.map((chosen: Card) => chosen.name)).toEqual(["Geezard", "Geezard", "Geezard", "Geezard", "Geezard"])
	})

	it("ignores a name that matches no card", () => {
		const { ui } = draw()

		chooseCard(ui.input(1), "Nobody")

		expect(ui.header(1).textContent).toBe(handLabel(1, 0))
		expect(ui.input(1).value).toBe("Nobody")
	})

	it("trims the name before looking it up", () => {
		const { ui } = draw()

		chooseCard(ui.input(1), "  Ifrit  ")

		expect(ui.header(1).textContent).toBe(handLabel(1, 1))
	})

	it("takes a card back out when its slot is clicked", () => {
		const { ui } = draw()
		chooseCard(ui.input(1), "Ifrit")
		chooseCard(ui.input(1), "Zell")

		ui.slots(1)[0].dispatch("click")

		expect(ui.header(1).textContent).toBe(handLabel(1, 1))
		expect(ui.slots(1)[0].title).toBe("Remove Zell")
		expect(ui.slots(1)[1].className).toBe("builder-slot")
	})

	it("tops a part-filled hand up to five, keeping the cards already chosen", () => {
		const { ui } = draw()
		chooseCard(ui.input(1), "Ifrit")

		ui.fillButton(1).dispatch("click")

		expect(ui.header(1).textContent).toBe(handLabel(1, 5))
		expect(ui.slots(1)[0].title).toBe("Remove Ifrit")
		expect(ui.slots(1).every((slot) => slot.className.includes("is-filled"))).toBe(true)
	})

	it("closes a hand once it holds five", () => {
		const { ui } = draw()

		ui.fillButton(1).dispatch("click")

		expect(ui.input(1).disabled).toBe(true)
		expect(ui.input(1).placeholder).toBe("Hand complete")
		expect(ui.fillButton(1).disabled).toBe(true)
		// A sixth card cannot be forced in through the field.
		chooseCard(ui.input(1), "Zell")
		expect(ui.header(1).textContent).toBe(handLabel(1, 5))
	})

	it("reopens a hand when a card is taken back out", () => {
		const { ui } = draw()
		ui.fillButton(1).dispatch("click")

		ui.slots(1)[0].dispatch("click")

		expect(ui.input(1).disabled).toBe(false)
		expect(ui.input(1).placeholder).toBe("Add a card by name…")
		expect(ui.fillButton(1).disabled).toBe(false)
	})

	it("only allows the game to start once both hands hold five", () => {
		const { ui } = draw()

		ui.fillButton(1).dispatch("click")
		expect(ui.startButton.disabled).toBe(true)

		ui.fillButton(2).dispatch("click")
		expect(ui.startButton.disabled).toBe(false)

		ui.slots(2)[4].dispatch("click")
		expect(ui.startButton.disabled).toBe(true)
	})

	it("hands both decks over when the game is started", () => {
		const { ui, onStart } = draw()
		fillBoth(ui)

		ui.startButton.dispatch("click")

		expect(onStart).toHaveBeenCalledOnce()
		const [p1Hand, p2Hand, firstPlayer] = onStart.mock.calls[0]!
		expect(p1Hand).toHaveLength(5)
		expect(p2Hand).toHaveLength(5)
		expect(p1Hand.every((chosen: Card) => catalogue.includes(chosen))).toBe(true)
		expect(firstPlayer).toBeUndefined()
	})

	it.each([
		["1", 1],
		["2", 2],
	] as const)("passes Player %s as the first player", (selection, firstPlayer) => {
		const { ui, onStart } = draw()
		fillBoth(ui)
		ui.firstPlayerSelect.value = selection

		ui.startButton.dispatch("click")

		expect(onStart.mock.calls[0]![2]).toBe(firstPlayer)
	})

	it("keeps the fields alive across a pick, so a name can follow a name", () => {
		const { ui } = draw()
		const input = ui.input(1)

		chooseCard(input, "Ifrit")
		chooseCard(input, "Zell")

		// The same node accepted both, rather than being replaced by the redraw.
		expect(input).toBe(ui.input(1))
		expect(ui.header(1).textContent).toBe(handLabel(1, 2))
	})

	it("replaces whatever the entry already held", () => {
		const onStart = vi.fn()
		vi.stubGlobal("document", { createElement: () => new FakeElement() })
		const entry = new FakeElement()
		entry.append(new FakeElement(), new FakeElement(), new FakeElement())

		drawDeckBuilder(entry as unknown as HTMLElement, catalogue, onStart)

		expect(entry.children).toHaveLength(2)
		expect(entry.children[0].className).toBe("deck-builder")
		expect(entry.children[1].className).toBe("builder-footer")
	})
})
