from flask import Flask
from flask_cors import CORS
from app.webhook.routes import webhook
from app.extensions import mongo_client
import os


def create_app():
    """Create and configure the Flask application"""
    
    app = Flask(__name__)
    
    # Enable CORS
    CORS(app)
    
    # Connect to MongoDB on startup
    mongo_url = os.getenv("MONGO_URI", "mongodb://localhost:27017/techStax")
    mongo_client.connect(mongo_url)
    
    # Register blueprints
    app.register_blueprint(webhook)
    
    # Root route
    @app.route('/')
    def index():
        return {
            "message": "GitHub Webhook Server",
            "endpoints": {
                "webhook": "/webhook/github (POST)",
                "health": "/webhook/health (GET)",
                "events": "/webhook/events (GET)",
                "latest": "/webhook/events/latest (GET)"
            }
        }
    
    print("🚀 Flask app created successfully!")
    return app
