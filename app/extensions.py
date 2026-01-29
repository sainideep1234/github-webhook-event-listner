from pymongo import MongoClient
from pymongo.collection import Collection
from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime
import os


class TypeOfEvents(str, Enum):
    PUSH = "push"
    PULL_REQUEST = "pull_request"
    MERGE = "merge"


class WebhookEvent(BaseModel):
    """Schema for storing webhook events in MongoDB"""
    author: str
    action: Optional[str] = None  # For PR: opened, closed, merged, etc.
    to_branch: Optional[str] = None
    from_branch: Optional[str] = None
    event_type: TypeOfEvents
    timestamp: str
    repository: str
    request_id: Optional[int] = None  # PR number
    commits: Optional[list] = None  # List of commits for push events
    message: Optional[str] = None  # Commit message or PR title


class MongoDbClient:
    """MongoDB client wrapper for webhook events"""
    
    def __init__(self):
        self._client: MongoClient = None
        self._db = None
        self._collection: Collection = None
        self._db_name = os.getenv("MONGO_DB_NAME", "github-webhooks")
        self._collection_name = os.getenv("MONGO_COLLECTION_NAME", "events")

    def connect(self, url: str = None):
        """Connect to MongoDB"""
        mongo_url = url or os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self._client = MongoClient(mongo_url)
        self._db = self._client[self._db_name]
        self._collection = self._db[self._collection_name]
        print(f"✅ Connected to MongoDB: {self._db_name}/{self._collection_name}")
        return self._client

    def insert_event(self, data: WebhookEvent) -> str:
        """Insert a webhook event into MongoDB"""
        result = self._collection.insert_one(data.model_dump())
        return str(result.inserted_id)

    def get_events(self, event_type: str = None, limit: int = 100):
        """Get events, optionally filtered by type"""
        query = {}
        if event_type:
            query["event_type"] = event_type
        return list(self._collection.find(query).sort("timestamp", -1).limit(limit))

    def get_latest_event(self):
        """Get the most recent event"""
        return self._collection.find_one(sort=[("timestamp", -1)])


# Global MongoDB instance
mongo_client = MongoDbClient()