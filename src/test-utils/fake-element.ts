/**
 * A minimal stand-in for the slice of the DOM the renderer touches, so the specs can
 * exercise the real rendering code without pulling in a full DOM implementation.
 */
export class FakeElement {
	innerHTML = ""
	className = ""
	textContent = ""
	children: FakeElement[] = []
	listeners = new Map<string, (event: Event) => void>()
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
}
