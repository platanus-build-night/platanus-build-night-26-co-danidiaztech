"""Root conftest — presence alone makes pytest add `backend/` to sys.path
(prepend import mode), so `backend/tests/test_*.py` can `import app...`
without needing the venv to be pip-installed as a package or PYTHONPATH set
by hand. No fixtures needed yet: the engine/features unit tests are pure
functions, no DB required.
"""
