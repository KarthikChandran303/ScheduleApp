#!/usr/bin/env python3
"""Reset test data for the scheduling app.

Deletes all Firestore activities, all Firestore user profiles, and all
Firebase Auth accounts EXCEPT the one matching KEEP_EMAIL below. Then
recreates the standard test accounts (Oogway, Gandalf, Totoro) and seeds a
batch of random activities across the current week.

Requires an active `firebase login` session (uses the CLI's cached OAuth
refresh token from ~/.config/configstore/firebase-tools.json).

Usage:
    python3 scripts/reset-test-data.py --yes
"""
import argparse
import json
import random
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT = 'scheduling-app-3e0ea'
KEEP_EMAIL = 'karthik.ihs30@gmail.com'
FIREBASE_TOOLS_CONFIG = Path.home() / '.config' / 'configstore' / 'firebase-tools.json'

# Public OAuth client used by the firebase-tools CLI itself.
CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

TEST_ACCOUNTS = [
    {'name': 'Oogway', 'email': 'oogway@test.com', 'password': 'Oogway123', 'requestedRole': 'general', 'requestStatus': 'none'},
    {'name': 'Gandalf', 'email': 'gandalf@test.com', 'password': 'Gandalf123', 'requestedRole': 'general', 'requestStatus': 'none'},
    {'name': 'Totoro', 'email': 'totoro@test.com', 'password': 'Totoro123', 'requestedRole': 'scheduler', 'requestStatus': 'pending'},
]

COLORS = ['#cfe4ff', '#bfe8df', '#ffe0a3', '#ffd0c7', '#d9ccf4']
TITLES = [
    'Team Kickoff', 'Design Review', 'Client Sync', 'Budget Planning', 'Sprint Retro',
    'Onboarding Session', 'Product Demo', 'Marketing Standup', 'Ops Check-in', 'Creative Workshop',
    'Vendor Call', 'Roadmap Review', 'Support Huddle', 'Training Session', 'Town Hall',
]
VENUES = ['Room A', 'Room B', 'Main Hall', 'Zoom', 'Rooftop Deck', 'Studio 2', 'Cafeteria']
DESCRIPTIONS = [
    'Weekly alignment on active priorities.',
    'Deep dive into current blockers and next steps.',
    'Review deliverables and gather feedback.',
    'Open forum for updates and questions.',
    'Planning session for upcoming milestones.',
]


def get_access_token():
    with open(FIREBASE_TOOLS_CONFIG) as f:
        cfg = json.load(f)
    refresh_token = cfg['tokens']['refresh_token']
    data = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    }).encode()
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())['access_token']


def request(method, url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(f'  ! {method} {url} -> {e.code} {e.read()}', file=sys.stderr)
        raise


def minutes_to_time(m):
    return f'{m // 60:02d}:{m % 60:02d}'


def date_key(date):
    return f'{date.year}-{date.month:02d}-{date.day:02d}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--yes', action='store_true', help='Actually perform the reset (required).')
    args = parser.parse_args()

    if not args.yes:
        print('This will DELETE all activities and all accounts except', KEEP_EMAIL)
        print('Re-run with --yes to proceed.')
        sys.exit(1)

    token = get_access_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    read_headers = {'Authorization': f'Bearer {token}'}

    # Resolve which UID to keep.
    auth_data = request('POST', f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:query', headers, {})
    keep_uid = None
    for u in auth_data.get('userInfo', []):
        if u.get('email') == KEEP_EMAIL:
            keep_uid = u.get('localId')
    if not keep_uid:
        print(f'Could not find an account for {KEEP_EMAIL}; aborting to avoid deleting everyone.', file=sys.stderr)
        sys.exit(1)
    print('Keeping account:', KEEP_EMAIL, keep_uid)

    # 1) Delete all activities.
    act_url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/activities'
    docs = request('GET', act_url, read_headers).get('documents', [])
    for doc in docs:
        request('DELETE', f"https://firestore.googleapis.com/v1/{doc['name']}", read_headers)
    print('Deleted activities:', len(docs))

    # 2) Delete all Firestore user docs except keep_uid.
    users_url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users'
    docs = request('GET', users_url, read_headers).get('documents', [])
    deleted = 0
    for doc in docs:
        uid = doc['name'].split('/')[-1]
        if uid == keep_uid:
            continue
        request('DELETE', f"https://firestore.googleapis.com/v1/{doc['name']}", read_headers)
        deleted += 1
    print('Deleted Firestore user docs:', deleted)

    # 3) Delete all Auth users except keep_uid.
    deleted = 0
    for u in auth_data.get('userInfo', []):
        uid = u.get('localId')
        if uid == keep_uid:
            continue
        request('POST', f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts:delete', headers, {'localId': uid})
        deleted += 1
    print('Deleted Auth users:', deleted)

    # 4) Recreate the standard test accounts.
    signup_url = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJECT}/accounts'
    uids_by_role = {'general': [], 'scheduler': []}
    all_uids = [keep_uid]
    for acc in TEST_ACCOUNTS:
        result = request('POST', signup_url, headers, {
            'email': acc['email'],
            'password': acc['password'],
            'displayName': acc['name'],
            'emailVerified': False,
        })
        uid = result['localId']
        all_uids.append(uid)
        doc_url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{uid}'
        fields = {
            'name': {'stringValue': acc['name']},
            'email': {'stringValue': acc['email']},
            'role': {'stringValue': 'unassigned'},
            'requestedRole': {'stringValue': acc['requestedRole']},
            'requestStatus': {'stringValue': acc['requestStatus']},
            'fcmToken': {'nullValue': None},
            'createdAt': {'timestampValue': '2026-08-16T00:00:00Z'},
        }
        request('PATCH', doc_url, headers, {'fields': fields})
        print('Recreated account:', acc['email'], uid)

    # 5) Seed random activities across the current week.
    import datetime
    today = datetime.date.today()
    start_of_week = today - datetime.timedelta(days=today.weekday() + 1 if today.weekday() != 6 else 0)
    days = [date_key(start_of_week + datetime.timedelta(days=i)) for i in range(7)]

    random.seed()
    created_count = 0
    for day in days:
        for _ in range(random.randint(2, 4)):
            start_slot = random.randint(6, 30)
            start_minutes = 270 + start_slot * 15  # 04:30 baseline
            duration = random.choice([45, 60, 75, 90, 120])
            end_minutes = min(start_minutes + duration, 1200)
            start_minutes = min(start_minutes, end_minutes - 30)

            assigned = random.sample(all_uids, random.randint(1, min(3, len(all_uids))))
            person_notes = {}
            if random.random() > 0.6:
                person_notes[random.choice(assigned)] = 'Please bring notes from last session.'

            fields = {
                'title': {'stringValue': random.choice(TITLES)},
                'day': {'stringValue': day},
                'startTime': {'stringValue': minutes_to_time(start_minutes)},
                'endTime': {'stringValue': minutes_to_time(end_minutes)},
                'assignedTo': {'arrayValue': {'values': [{'stringValue': uid} for uid in assigned]}},
                'description': {'stringValue': random.choice(DESCRIPTIONS)},
                'venue': {'stringValue': random.choice(VENUES)},
                'personNotes': {'mapValue': {'fields': {k: {'stringValue': v} for k, v in person_notes.items()}}},
                'color': {'stringValue': random.choice(COLORS)},
                'isPublic': {'booleanValue': random.random() > 0.25},
            }
            request('POST', act_url, headers, {'fields': fields})
            created_count += 1

    print('Created activities:', created_count)
    print('Reset complete.')


if __name__ == '__main__':
    main()
