from flask import Flask
from flask_cors import CORS

from main.config import Config
from main.routes import register_routes
from main.errors import register_error_handlers


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, origins=app.config["CORS_ORIGINS"])

    register_routes(app)
    register_error_handlers(app)

    return app