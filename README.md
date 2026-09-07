# APP-003 — Любимые места

Персональная CRM мест: быстрый выбор вариантов под ситуацию, каталог мест, история посещений и накопленное личное знание.

## Статус

`v0.1` — ПРОТОТИП В РАБОТЕ / первичная сборка GitHub Pages + Supabase.

## Архитектура

- Frontend: GitHub Pages, статический HTML/CSS/JS.
- Auth + DATA: Supabase `MINI-APPS-CLOUD`.
- Таблицы: `app003_places`, `app003_visits`, `app003_reference_options`, `app003_settings`.
- Без Google Apps Script runtime.
- Google Drive используется для ТЗ и независимого BACKUP SAFE.

## Главный принцип

`Place` — текущее накопленное знание о месте.

`Visit` — отдельный конкретный прожитый опыт.

История Visit не уничтожается изменением текущего состояния Place.

## Ссылки

- Live: https://setjip-spec.github.io/APP-003-Favorite-Places/
- Repository: https://github.com/setjip-spec/APP-003-Favorite-Places
- ТЗ: `docs/APP-003-TZ.md`
- Все канонические ссылки: `docs/LINKS.md`
- Recovery: `docs/RECOVERY.md`

## Источник данных

В стартовую облачную базу импортированы 30 мест `LM-0001 … LM-0030` из рабочей таблицы «Любимые места». На момент миграции фактических Visit = 0.
