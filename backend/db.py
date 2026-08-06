import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "lablens")

if not MONGODB_URI:
    raise ValueError(
        "MONGODB_URI not found in .env! Add your MongoDB Atlas connection "
        "string, e.g. mongodb+srv://user:pass@cluster.mongodb.net"
    )

_client = MongoClient(MONGODB_URI)
db = _client[MONGODB_DB_NAME]

reports_collection = db["reports"]
appointments_collection = db["appointments"]
medications_collection = db["medications"]

reports_collection.create_index("id", unique=True)
reports_collection.create_index([("email", 1), ("patient_key", 1)])
appointments_collection.create_index("id", unique=True)
appointments_collection.create_index("email")
medications_collection.create_index("id", unique=True)
medications_collection.create_index("email")
