.PHONY: server query drop clean reset

server:
	.venv/bin/python run_server.py

query:
	.venv/bin/python run_query.py

drop:
	.venv/bin/python -m src.scripts.drop_db

clean:
	rm -rf cocoindex.db .cocoindex.db

reset: drop clean
	@echo "Database and local state have been reset!"
