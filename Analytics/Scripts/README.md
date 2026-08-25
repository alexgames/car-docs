# Analytics/Scripts

Скрипты анализа дампов БД проекта. Локальный MySQL, без облака — всё крутится на машине владельца.

## Как поднять базы (один раз при новой выгрузке дампов)

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS carproject_3dl CHARACTER SET utf8mb4;"
mysql -u root -e "CREATE DATABASE IF NOT EXISTS carproject_stat CHARACTER SET utf8mb4;"
mysql -u root carproject_3dl  < ../data/<дата>/cy74408_3dl.sql
mysql -u root carproject_stat < ../data/<дата>/cy74408_stat.sql

# Во view stat.levels_count / stat.timepoint_count зашит DEFINER на несуществующего
# пользователя cy74408@localhost — если ругается при чтении, пересоздать под текущим:
mysql -u root carproject_stat -e "
  DROP VIEW IF EXISTS levels_count;
  CREATE VIEW levels_count AS SELECT userId, COUNT(0) AS count FROM levels GROUP BY userId;
  DROP VIEW IF EXISTS timepoint_count;
  CREATE VIEW timepoint_count AS SELECT userId, COUNT(0) AS count FROM timepoint GROUP BY userId;
"
```

Базы называются `carproject_3dl` (игровая БД — users/devices/works/paidItems/...)
и `carproject_stat` (статистика — сессии/клики/аналитика).

## Структура таблиц (кратко)

- `carproject_3dl.users` — игроки. **Джойн с devices по `userId`, не по `deviceId`** (в users
  поле `deviceId` не используется/всегда 0 — легко ошибиться, см. `metric_installs.py`).
- `carproject_3dl.devices` — устройства, `osType`: `8` = iOS, `11` = Android, `0` = неизвестно/веб.
- `carproject_3dl.paidItems` — все транзакции (реальные и внутриигровые). Важно:
  - `fake=1` — тестовые транзакции разработчика (все датированы до 2024-08), исключать.
  - `itemType='paid'` и `itemType='credits'` с `fake=0` — **реальные деньги**.
  - `itemType='soft'` — трата игровой (не реальной) валюты, не доход.
- `carproject_stat.startSession` / `finishSession` — старт/финиш игровых сессий, лучший
  прокси для DAU/MAU и ретеншена.
- `carproject_stat.timePoint` — **НЕ используйте как общий сигнал активности.** При визуально
  большом объёме (476k строк) это в основном шаги воронки обучения на первой сессии:
  распределение по месяцам почти 1-в-1 повторяет число новых регистраций месяца, и только
  71 из 6289 пользователей вообще имеют хоть одно событие после дня регистрации (для сравнения
  у startSession таких 1026). Проверено эмпирически при подготовке ретеншена.
- `carproject_stat.clicks` — клики по коротким маркетинговым ссылкам (соцсети), есть `platform`
  (android/iphone/ipad/other) и `link_code`.
- `carproject_stat.early_access_emails` — лист ожидания Android.

## Скрипты

- `lib.py` — общий helper (`query(sql, db=...)` → pandas DataFrame через `mysql` CLI).
- `metric_installs.py` — установки по месяцам/платформам.
- `metric_revenue.py` — доход по месяцам/продуктам, ARPU/ARPPU, детектор "давно не было
  реальных транзакций" (`last_transaction_gap_days`).
- `metric_retention.py` — D1/D7/D30 и помесячный когортный ретеншен (на `startSession`).
- `metric_marketing.py` — клики, топ ссылок, рост листа ожидания.
- `build_report.py` — прогоняет всё и пишет `Analytics/reports/report-<дата>.md`.

Запуск (нужен Python 3 + pandas + tabulate, уже установлены):

```bash
cd Analytics/Scripts
python3 build_report.py
```

Каждый метрик-скрипт можно запускать отдельно (`python3 metric_revenue.py`) для быстрой
проверки в терминале без сборки полного отчёта.
