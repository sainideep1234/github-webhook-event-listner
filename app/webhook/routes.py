from flask import Blueprint, request, jsonify
from datetime import datetime
from app.extensions import mongo_client, WebhookEvent, TypeOfEvents

webhook = Blueprint('Webhook', __name__, url_prefix='/webhook')


@webhook.route('/health', methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Webhook server is running"}), 200


@webhook.route('/github', methods=["POST"])
def github_webhook():
    """
    Main GitHub webhook endpoint
    Handles: push, pull_request events
    """
    # Verify content type
    if request.content_type != "application/json":
        return jsonify({"error": "Content-Type must be application/json"}), 400

    payload = request.json
    if not payload:
        return jsonify({"error": "Empty payload"}), 400

    # Get the event type from GitHub headers
    github_event = request.headers.get("X-GitHub-Event", "unknown")
    
    print(f"📥 Received GitHub event: {github_event}")

    try:
        if github_event == "push":
            return handle_push_event(payload)
        elif github_event == "pull_request":
            return handle_pull_request_event(payload)
        elif github_event == "ping":
            return handle_ping_event(payload)
        else:
            return jsonify({
                "message": f"Event '{github_event}' received but not processed",
                "status": "ignored"
            }), 200
    except Exception as e:
        print(f"❌ Error processing webhook: {str(e)}")
        return jsonify({"error": str(e)}), 500


def handle_ping_event(payload: dict):
    """Handle GitHub ping event (sent when webhook is first configured)"""
    print("🏓 Ping event received - Webhook is configured correctly!")
    return jsonify({
        "message": "Pong! Webhook configured successfully",
        "zen": payload.get("zen", ""),
        "hook_id": payload.get("hook_id")
    }), 200


def handle_push_event(payload: dict):
    """Handle GitHub push events"""
    
    # Extract commit info
    commits = []
    for commit in payload.get("commits", []):
        commits.append({
            "id": commit.get("id", "")[:7],
            "message": commit.get("message", ""),
            "author": commit.get("author", {}).get("name", ""),
            "timestamp": commit.get("timestamp", "")
        })

    # Determine branch from ref (refs/heads/main -> main)
    ref = payload.get("ref", "")
    branch = ref.replace("refs/heads/", "") if ref else "unknown"

    event = WebhookEvent(
        author=payload.get("pusher", {}).get("name", "unknown"),
        event_type=TypeOfEvents.PUSH,
        to_branch=branch,
        timestamp=datetime.utcnow().isoformat(),
        repository=payload.get("repository", {}).get("full_name", "unknown"),
        commits=commits,
        message=payload.get("head_commit", {}).get("message", "") if payload.get("head_commit") else ""
    )

    # Store in MongoDB
    event_id = mongo_client.insert_event(event)
    
    print(f"✅ Push event stored: {event_id}")
    print(f"   Author: {event.author}")
    print(f"   Branch: {branch}")
    print(f"   Commits: {len(commits)}")

    return jsonify({
        "message": "Push event processed successfully",
        "event_id": event_id,
        "author": event.author,
        "branch": branch,
        "commit_count": len(commits)
    }), 200


def handle_pull_request_event(payload: dict):
    """Handle GitHub pull request events"""
    
    pr = payload.get("pull_request", {})
    action = payload.get("action", "unknown")  # opened, closed, merged, etc.
    
    # Check if PR was merged
    event_type = TypeOfEvents.MERGE if pr.get("merged") else TypeOfEvents.PULL_REQUEST

    event = WebhookEvent(
        author=pr.get("user", {}).get("login", "unknown"),
        action=action,
        event_type=event_type,
        from_branch=pr.get("head", {}).get("ref", ""),
        to_branch=pr.get("base", {}).get("ref", ""),
        timestamp=datetime.utcnow().isoformat(),
        repository=payload.get("repository", {}).get("full_name", "unknown"),
        request_id=pr.get("number"),
        message=pr.get("title", "")
    )

    # Store in MongoDB
    event_id = mongo_client.insert_event(event)

    print(f"✅ Pull Request event stored: {event_id}")
    print(f"   Action: {action}")
    print(f"   Author: {event.author}")
    print(f"   PR #{event.request_id}: {event.from_branch} → {event.to_branch}")

    return jsonify({
        "message": f"Pull request ({action}) processed successfully",
        "event_id": event_id,
        "action": action,
        "pr_number": event.request_id,
        "is_merged": event_type == TypeOfEvents.MERGE
    }), 200


@webhook.route('/events', methods=["GET"])
def get_events():
    """Get all stored webhook events"""
    event_type = request.args.get("type")  # Optional filter
    limit = request.args.get("limit", 50, type=int)
    
    events = mongo_client.get_events(event_type=event_type, limit=limit)
    
    # Convert ObjectId to string for JSON serialization
    for event in events:
        event["_id"] = str(event["_id"])
    
    return jsonify({
        "count": len(events),
        "events": events
    }), 200


@webhook.route('/events/latest', methods=["GET"])
def get_latest_event():
    """Get the most recent webhook event"""
    event = mongo_client.get_latest_event()
    
    if event:
        event["_id"] = str(event["_id"])
        return jsonify(event), 200
    else:
        return jsonify({"message": "No events found"}), 404
