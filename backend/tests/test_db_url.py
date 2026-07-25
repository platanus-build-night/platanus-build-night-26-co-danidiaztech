"""The DATABASE_URL scheme that took down the first Render deploy.

Hosted providers hand out a bare `postgresql://` (Render) or legacy
`postgres://` (Heroku lineage). SQLAlchemy maps both to psycopg2, which this
project does not install — the service died on boot with
`ModuleNotFoundError: No module named 'psycopg2'`. These lock in the rewrite.
"""
from app.db import normalize_database_url


def test_render_style_url_is_pinned_to_psycopg3():
    assert (
        normalize_database_url("postgresql://u:p@dpg-abc.oregon-postgres.render.com/db")
        == "postgresql+psycopg://u:p@dpg-abc.oregon-postgres.render.com/db"
    )


def test_legacy_heroku_scheme_is_pinned_too():
    assert (
        normalize_database_url("postgres://u:p@host:5432/db")
        == "postgresql+psycopg://u:p@host:5432/db"
    )


def test_explicit_driver_is_left_alone():
    url = "postgresql+psycopg://trainer:trainer@localhost:5433/trainer"
    assert normalize_database_url(url) == url


def test_credentials_and_query_params_survive_the_rewrite():
    # Managed providers routinely append sslmode; mangling it would swap one
    # boot failure for another.
    assert normalize_database_url("postgresql://u:p%40ss@h/db?sslmode=require") == (
        "postgresql+psycopg://u:p%40ss@h/db?sslmode=require"
    )


def test_non_postgres_urls_are_untouched():
    assert normalize_database_url("sqlite:///./local.db") == "sqlite:///./local.db"
