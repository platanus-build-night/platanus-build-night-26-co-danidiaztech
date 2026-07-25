.PHONY: db backend frontend dev seed stop

db:
	docker compose up -d

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) db
	( $(MAKE) backend & )
	( $(MAKE) frontend & )

seed:
	cd backend && .venv/bin/python seed/seed.py

stop:
	docker compose down
