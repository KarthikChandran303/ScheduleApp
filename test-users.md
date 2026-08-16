# Test Users

Last reset on 2026-08-16 using `scripts/reset-test-data.py`. Karthik's account (`karthik.ihs30@gmail.com`) is always preserved and untouched by the reset script.

| Name | Email | Password | Role | Access request |
| --- | --- | --- | --- | --- |
| Oogway | `oogway@test.com` | `Oogway123` | unassigned | none |
| Gandalf | `gandalf@test.com` | `Gandalf123` | unassigned | none |
| Totoro | `totoro@test.com` | `Totoro123` | unassigned | **pending scheduler request** |

Use these only as test credentials. Rotate or delete them before production use.

## Resetting test data

To wipe all activities and all accounts except Karthik's, then recreate the table above with fresh random activities for the current week:

```sh
python3 scripts/reset-test-data.py --yes
```

Requires an active `firebase login` session (the script reuses the Firebase CLI's cached credentials — no service account needed).
