type CardAttributes = {
	north: number
	south: number
	east: number
	west: number
}

export type Card = {
	attributes: CardAttributes
	imageFilename: string
	level: number
	name: string
}
