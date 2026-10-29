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

static:             ## versione senza backend (motore nel browser) in frontend/dist-static
	python pipeline/export_static.py
	cd frontend && rm -rf dist-static && VITE_STATIC=1 npx vite build --outDir dist-static
	mkdir -p frontend/dist-static/data frontend/dist-static/geo
	cp data/static/* frontend/dist-static/data/ && cp data/geo/*.geojson frontend/dist-static/geo/

WEB_DIR = frontend/dist-web/transport-analytics

web:                ## versione statica per hosting web (con mappa di base) in $(WEB_DIR)
	python pipeline/export_static.py
	cd frontend && rm -rf dist-web && VITE_STATIC=1 VITE_BASEMAP=1 VITE_AGENT=1 npx vite build --outDir dist-web/transport-analytics
	mkdir -p $(WEB_DIR)/data $(WEB_DIR)/geo
	cp data/static/* $(WEB_DIR)/data/ && cp data/geo/*.geojson $(WEB_DIR)/geo/
	cp frontend/deploy/vercel.json frontend/deploy/package.json $(WEB_DIR)/
	mkdir -p $(WEB_DIR)/api && cp frontend/deploy/api/*.js $(WEB_DIR)/api/

deploy-vercel: web  ## pubblica su Vercel (richiede VERCEL_TOKEN)
	cd $(WEB_DIR) && npx --yes vercel deploy --prod --yes --token "$$VERCEL_TOKEN"
