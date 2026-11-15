import json
import os
import urllib.request

URL = "https://onjipuldngbdptldkpoe.supabase.co"
KEY = os.environ["SB_KEY"]

items = [
    ("a7632b66-274f-4f19-a099-e7c6259673de", "o0sM6JNB6J4", "https://i.ytimg.com/vi/o0sM6JNB6J4/hqdefault.jpg"),
    ("57765dab-e04d-4137-91e9-38c718197c8c", "b1ooKSJNxL8", "https://i.ytimg.com/vi/b1ooKSJNxL8/hqdefault.jpg"),
    ("fc1f12f2-c3c8-43d8-be87-7f6397010de2", "vSpZN9uGgHk", "https://i.ytimg.com/vi/vSpZN9uGgHk/hqdefault.jpg"),
    ("49bbae18-5287-4135-88ed-96964eab3276", "yraS7L8s25g", "https://i.ytimg.com/vi/yraS7L8s25g/hqdefault.jpg"),
    ("fddfae5f-60c5-482f-9266-91ae95a442cc", "1KaCz6jmnoc", "https://i.ytimg.com/vi/1KaCz6jmnoc/hqdefault.jpg"),
    ("6e0b1565-f0ed-4cfc-a460-4c6111ba98a1", "0zGDQ9r36p4", "https://i.ytimg.com/vi/0zGDQ9r36p4/hqdefault.jpg"),
    ("fb6c28a9-dcd1-4264-940e-d9ffd71a14e3", "SSMuzZcYbww", "https://i.ytimg.com/vi/SSMuzZcYbww/hqdefault.jpg"),
    ("15bcc456-4538-4735-89b2-7e0c3ec55617", "26gYD2CdPAA", "https://i.ytimg.com/vi/26gYD2CdPAA/hqdefault.jpg"),
    ("13f65a50-1432-4c9d-a744-f8de839abff9", "eI-NN6p689o", "https://i.ytimg.com/vi/eI-NN6p689o/hqdefault.jpg"),
    ("0cfbb317-ea0d-4384-8f22-c1d132ee171a", "uPMj5c1ZfKo", "https://i.ytimg.com/vi/uPMj5c1ZfKo/hqdefault.jpg"),
    ("9f91ecd4-5cc7-4c69-a16a-e4e1dbd05634", "hyoCVeDFHGg", "https://i.ytimg.com/vi/hyoCVeDFHGg/hqdefault.jpg"),
    ("b710c5c9-1190-432a-97b8-213432e48021", "9I4NoCB67js", "https://i.ytimg.com/vi/9I4NoCB67js/hqdefault.jpg"),
    ("9c60c5ce-ae3d-4366-b7f2-6851ed7af648", "5TfNVIZ1rWo", "https://i.ytimg.com/vi/5TfNVIZ1rWo/hqdefault.jpg"),
    ("a5764d8a-abc6-4cd6-9ff1-6052bf3f096e", "iu4goEjOJkE", "https://i.ytimg.com/vi/iu4goEjOJkE/hqdefault.jpg"),
    ("0073530e-c107-4b99-94b1-e57f9dfb7b50", "VwF3RfWhPFw", "https://i.ytimg.com/vi/VwF3RfWhPFw/hqdefault.jpg"),
    ("be3bf6d1-ec0c-4784-9b5f-ec8b10dd2ac8", "4W9r5HEHjKA", "https://i.ytimg.com/vi/4W9r5HEHjKA/hqdefault.jpg"),
    ("fd015408-3291-415e-917b-9eb4d00e8ada", "Z7ttXnItcpE", "https://i.ytimg.com/vi/Z7ttXnItcpE/hqdefault.jpg"),
    ("b4b88383-852e-4fd3-8682-44ec680d10ff", "LDBPnVzJFp8", "https://i.ytimg.com/vi/LDBPnVzJFp8/hqdefault.jpg"),
    ("b429570f-5de0-4910-8048-8879e6be7455", "F-T13qqxSlc", "https://i.ytimg.com/vi/F-T13qqxSlc/hqdefault.jpg"),
    ("ef13b949-7cff-42df-aa1f-5e6ff0575f6e", "LBctll6gh7Y", "https://i.ytimg.com/vi/LBctll6gh7Y/hqdefault.jpg"),
    ("f975ea0b-256d-40b4-9791-c81f2df5bfea", "x6QA3m58DQw", "https://i.ytimg.com/vi/x6QA3m58DQw/hqdefault.jpg"),
    ("414adcee-2fa7-4861-b77c-143874abe190", "v8Y3NL1KeNQ", "https://i.ytimg.com/vi/v8Y3NL1KeNQ/hqdefault.jpg"),
    ("d82b66a8-25ea-4238-a48b-1f8ebb0862e2", "OsSlxBluwc0", "https://i.ytimg.com/vi/OsSlxBluwc0/hqdefault.jpg"),
    ("d50e73c8-819c-40d7-976f-8674f38afded", "kqn5GSrnfkg", "https://i.ytimg.com/vi/kqn5GSrnfkg/hqdefault.jpg"),
    ("43303892-d19f-4b09-ada1-cb795cc3f82b", "qkGczC3ZqE0", "https://i.ytimg.com/vi/qkGczC3ZqE0/hqdefault.jpg"),
    ("dd416b95-980b-4228-8744-86822258849c", "QZBn1e9pr2Q", "https://i.ytimg.com/vi/QZBn1e9pr2Q/hqdefault.jpg"),
    ("e398fce7-fa28-4ce7-b439-9f8c04f7afc2", "HtJS32n6LNQ", "https://i.ytimg.com/vi/HtJS32n6LNQ/hqdefault.jpg"),
    ("02f4ad8f-7e66-4b1b-ba6d-dbf8323740ed", "U0PeZmFBYCI", "https://i.ytimg.com/vi/U0PeZmFBYCI/hqdefault.jpg"),
    ("d7faee67-6548-4a78-9a96-e10d3657947f", "ZRebVq_TseY", "https://i.ytimg.com/vi/ZRebVq_TseY/hqdefault.jpg"),
    ("e27f5864-b795-496e-a40b-a44951965302", "Lny5JOMeYnE", "https://i.ytimg.com/vi/Lny5JOMeYnE/hqdefault.jpg"),
    ("7b5e6528-caaa-46ef-849a-8e7d38c748dc", "xHHSfqs80F4", "https://i.ytimg.com/vi/xHHSfqs80F4/hqdefault.jpg"),
    ("eed137bb-f38c-453c-9454-bfec76aa5a6d", "Op_Iv-Kj1FI", "https://i.ytimg.com/vi/Op_Iv-Kj1FI/hqdefault.jpg"),
]

headers_base = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

inserted = 0
skipped_existing = 0
errors = []

for meme_id, vid, thumb in items:
    # check existing
    check_url = f"{URL}/rest/v1/meme_contents?meme_id=eq.{meme_id}&is_representative=eq.true&select=id"
    req = urllib.request.Request(check_url, headers=headers_base)
    try:
        with urllib.request.urlopen(req) as resp:
            existing = json.loads(resp.read().decode())
    except Exception as e:
        errors.append((meme_id, "check_failed", str(e)))
        continue

    if existing:
        skipped_existing += 1
        continue

    body = json.dumps({
        "meme_id": meme_id,
        "type": "embed",
        "platform": "YouTube",
        "content_id": vid,
        "url": f"https://www.youtube.com/watch?v={vid}",
        "thumbnail_url": thumb,
        "is_representative": True,
        "availability": "live",
    }).encode()

    post_headers = dict(headers_base)
    post_headers["Prefer"] = "return=minimal"

    req = urllib.request.Request(f"{URL}/rest/v1/meme_contents", data=body, headers=post_headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        inserted += 1
    except Exception as e:
        errors.append((meme_id, "insert_failed", str(e)))

print(json.dumps({
    "total_candidates": len(items),
    "inserted": inserted,
    "skipped_existing": skipped_existing,
    "errors": errors,
}, ensure_ascii=False, indent=2))
