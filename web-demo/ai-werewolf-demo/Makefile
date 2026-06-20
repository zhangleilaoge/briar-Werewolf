.PHONY: dev build preview test lint lint-fix clean install help

help:
	@echo "Available commands:"
	@echo "  make dev       - Start the Astro dev server"
	@echo "  make build     - Lint and build the production site"
	@echo "  make preview   - Preview the production build"
	@echo "  make test      - Run the Vitest test suite"
	@echo "  make lint      - Run Biome linter"
	@echo "  make lint-fix  - Run Biome linter with auto-fix"
	@echo "  make install   - Install dependencies with bun"
	@echo "  make clean     - Remove build artifacts"

dev:
	bun run dev

build:
	bun run build

preview:
	bun run preview

test:
	bun run test

lint:
	bun run lint

lint-fix:
	bun run lint:fix

install:
	bun install

clean:
	rm -rf dist .astro
