.PHONY: install data warehouse dev-api dev-web build run docker-data docker-up

install:            ## dipendenze locali
	pip install -r backend/requirements.txt -r pipeline/requirements.txt
	cd frontend && npm ci

data:               ## scarica estrazione (GCS) e geometrie
	python pipeline/fetch_data.py

warehouse:          ## CSV -> DuckDB + geometrie semplificate
	python pipeline/build_warehouse.py

dev-api:            ## API con reload su :8000
	cd backend && uvicorn app.main:app --reload --port 8000

dev-web:            ## frontend con hot reload su :5173 (proxy verso :8000)
	cd frontend && npm run dev

build:              ## build di produzione del frontend
	cd frontend && npm run build

run: build          ## app completa su :8000
	cd backend && uvicorn app.main:app --port 8000

docker-data:        ## pipeline in container (richiede GCP_KEY_FILE)
	docker compose --profile pipeline run --rm pipeline

docker-up:
	docker compose up --build app
