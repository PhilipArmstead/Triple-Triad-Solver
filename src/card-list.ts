import { cards } from "./data/cards"
import type { Card } from "./types"

export const injectCardList = (entry: HTMLElement) => {
	// Group cards by level
	const groupedCards = cards.reduce((acc: { [key: number]: Card[] }, card) => {
		if (!acc[card.level]) {
			acc[card.level] = []
		}
		acc[card.level].push(card)
		return acc
	}, {})

	// Create a container for each level and append the cards to it
	Object.entries(groupedCards).forEach(([level, cards]) => {
		const levelContainer = document.createElement("div")
		levelContainer.classList.add("level-container")
		levelContainer.innerHTML = `<h2>Level ${level}</h2>`

		const cardListContainer = document.createElement("div")
		cardListContainer.classList.add("card-list")
		cards.forEach((card) => {
			const cardElement = document.createElement("div")
			cardElement.innerHTML = `
				<img src="/assets/cards/${card.imageFilename}" alt="${card.name}" />
				<p class="card-name">${card.name}</p>
			`
			cardListContainer.appendChild(cardElement)
		})
		levelContainer.appendChild(cardListContainer)

		entry.appendChild(levelContainer)
	})
}
