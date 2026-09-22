from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Central app config. Values are pulled from environment variables
    (or a .env file in the backend/ folder during local development).
    """
    app_name: str = "Portfolio Tracker"
    database_url: str = "postgresql://user:password@localhost:5432/portfolio_tracker"

    # XTB API credentials (per-user tokens will live in the DB later,
    # these are just placeholders for local dev/testing)
    xtb_user_id: str = ""
    xtb_password: str = ""
    xtb_ws_url: str = "wss://ws.xtb.com/demo"  # use real endpoint for live accounts

    class Config:
        env_file = ".env"


settings = Settings()
