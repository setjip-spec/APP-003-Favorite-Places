# APP-003 — RECOVERY

## Source of truth

1. GitHub `main` — canonical source code and current working specification.
2. Supabase `MINI-APPS-CLOUD` — canonical user DATA.
3. Google `BACKUP SAFE` — independent disaster-recovery layer.

## Recovery order

### 1. Ordinary regression

Use Git history/revert and redeploy GitHub Pages.

### 2. Repository loss

Open Google BACKUP SAFE:
https://drive.google.com/drive/folders/1VTsTkl0pF4GupyUP8a_MNhtwnIQd6x-B

Restore source snapshot into a repository named `APP-003-Favorite-Places`, then enable GitHub Pages from `main / root`.

### 3. DATA loss

Restore only APP-003 data into:

- `app003_places`
- `app003_visits`
- `app003_reference_options`
- `app003_settings`

Never overwrite another APP-ID data set.

### 4. Post-recovery checks

- Login via the shared Supabase account.
- 30 baseline Place rows are present unless later intentionally changed.
- Create/edit a Place and verify after F5.
- Add a Visit; Place becomes `Был`, `visits_count` and `last_visited_at` update.
- Check the same data on phone.
- Check archive/restore.
- Create a new Google BACKUP SAFE snapshot after recovery.

## Security

Frontend may contain only the Supabase publishable key. Never place `service_role` / secret keys in GitHub Pages.
