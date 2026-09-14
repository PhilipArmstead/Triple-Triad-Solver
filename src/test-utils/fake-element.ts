/**
 * A minimal stand-in for the slice of the DOM the renderer touches, so the specs can
 * exercise the real rendering code without pulling in a full DOM implementation.
 */
export class FakeElement {
	className = ""
	textContent = ""
	id = ""
	value = ""
	label = ""
	title = ""
	type = ""
	placeholder = ""
	disabled = false
	attributes = new Map<string, string>()
	children: FakeElement[] = []
	listeners = new Map<string, (event: Event) => void>()

	#innerHTML = ""

	/**
	 * Assigning innerHTML replaces everything inside the element, so the stub drops
	 * its children to match. The renderers use it to empty a node before redrawing,
	 * and without this they would appear to append to the previous draw forever.
	 */
	get innerHTML(): string {
		return this.#innerHTML
	}

	set innerHTML(value: string) {
		this.#innerHTML = value
		this.children = []
		this.textContent = ""
	}

	classList = {
		add: (name: string) => {
			this.className += ` ${name}`
		},
		remove: (name: string) => {
			this.className = this.className.replace(` ${name}`, "")
		},
		toggle: (name: string, enabled: boolean) => (enabled ? this.classList.add(name) : this.classList.remove(name)),
	}

	addEventListener(name: string, listener: EventListener): void {
		this.listeners.set(name, listener as (event: Event) => void)
	}

	append(...nodes: (FakeElement | string)[]): void {
		for (const node of nodes) {
			if (typeof node === "string") {
				this.textContent += node
			} else {
				this.children.push(node)
			}
		}
	}

	dispatch(name: string, event = {} as Event): void {
		this.listeners.get(name)?.(event)
	}

	querySelectorAll<T extends FakeElement>(): T[] {
		return this.children as T[]
	}

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value)
	}
}
