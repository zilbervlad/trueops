import json
from urllib import request as urlrequest

from app.models import TrueOpsPushToken, TrueOpsThreadMember


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_expo_pushes(messages):
    if not messages:
        return

    try:
        payload = json.dumps(messages).encode("utf-8")
        req = urlrequest.Request(
            EXPO_PUSH_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        with urlrequest.urlopen(req, timeout=8) as response:
            response.read()
    except Exception:
        # Push should never break sending a message.
        return


def send_message_pushes(thread, message):
    if not thread or not message:
        return

    member_user_ids = [
        row.user_id
        for row in TrueOpsThreadMember.query.filter_by(thread_id=thread.id).all()
        if row.user_id != message.sender_user_id and not row.hidden_at
    ]

    if not member_user_ids:
        return

    tokens = (
        TrueOpsPushToken.query
        .filter(TrueOpsPushToken.company_id == thread.company_id)
        .filter(TrueOpsPushToken.user_id.in_(member_user_ids))
        .filter(TrueOpsPushToken.is_active.is_(True))
        .all()
    )

    if not tokens:
        return

    sender_name = message.sender.name if message.sender else "TrueOps"
    title = thread.name or "TrueOps Message"

    payloads = []

    for token in tokens:
        payloads.append({
            "to": token.token,
            "sound": "default",
            "title": title,
            "body": f"{sender_name}: {message.body[:120]}",
            "data": {
                "type": "message",
                "thread_id": thread.id,
                "message_id": message.id,
            },
        })

    send_expo_pushes(payloads)
