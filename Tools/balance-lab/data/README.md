# Balance Lab — data

Рабочие копии конфигов баланса. Правь здесь через `balance-lab/index.html`, в игру/на сервер перенос — отдельный шаг (скрипт/кнопка, не сделан).

## Источники

| Файл | Взято из | Статус |
|---|---|---|
| `static_prices.csv` | `Assets/Content/staticConfigs/Resources/static_prices.csv` (Unity, уже был конфигом) | Живой конфиг игры — правки нужно переносить обратно в этот путь |
| `static_stars.csv` | `Assets/Content/staticConfigs/Resources/static_stars.csv` (Unity, уже был конфигом) | Живой конфиг игры |
| `server_boosts.csv` | `server/api/general/balanceParams.php` — `boostGemPrice()`, `rankingDelay()` | ⚠️ Хардкод на сервере, ещё НЕ читается из файла — нужно дописать сервер |
| `server_ranks.csv` | `balanceParams.php` — пороги рангов (`getRankByRating`) + награды (`getRewardForRank`, `getRewardForSameRank`) | ⚠️ Хардкод, сервер не читает |
| `server_levels.csv` | `balanceParams.php` — `getTargetXpForLevel()`, `getRewardForNewLevel()` | ⚠️ Хардкод, сервер не читает |
| `server_challenge_rewards.csv` | `balanceParams.php` — `getRewardForChallenge()` | ⚠️ Хардкод, сервер не читает |
| `server_misc.csv` | `balanceParams.php` — `maxLevel()`, `votesRestToPublish()`, `initWorkRating()` | ⚠️ Хардкод, сервер не читает |
| `server_chapter_stars.csv` | `balanceParams.php` — `getAllTargetStarsForChapter()` | ⚠️ Хардкод, сервер не читает. **См. конфликт ниже** |

## ⚠️ Найденный конфликт — требует решения, не разрешил сам
`server_chapter_stars.csv` (из PHP): Shapes=0, America=30, Urban=60, GT=90, Cartoon=120.
Первый блок в `static_stars.csv` (уже был в Unity-конфиге): Shapes=0, America=50, Urban=45, GT=1000, Cartoon=1000, Wedge=1000, Offroad=1000, Over=1000.

Цифры сильно расходятся — либо это два разных смысла (например "нужно звёзд, чтобы открыть след. главу" на сервере vs что-то другое в Unity-файле), либо один из двух источников устарел/не используется. Не стал угадывать и объединять — реши сам, какой источник актуален, прежде чем переносить в единый конфиг.

## Не найдено (не пробел поиска, похоже на факт)
Прямых цен на "Экстрас"-детали (покупка за монеты/кристаллы) в коде нет — судя по `buyItem.php` (`// TODO check balance`, цену присылает клиент) и общей структуре, экстра-детали открываются прогрессией/промокодами, не продаются напрямую. Если это не так — подскажи, где искать, поищу ещё раз.

## Гипотетические конфиги (системы либо не выкачены, либо не найдены как живые)
- `server_daily_tasks.csv`, `server_daily_task_rewards.csv` — дейлики. В коде нашёл только `server/api/unused/getTasks.php` и `submitTask.php` — то есть либо система ещё не в проде, либо названа иначе. Цифры — придуманные, правь по своему усмотрению.
- `server_ads.csv` — `gemsPerAd`/`maxAdsPerDay` — не нашёл в коде, тоже гипотеза.
- `content_pool_TEST.csv` — тестовый плейсхолдер вместо реального распределения контента по Экстрас (эта работа ещё не сделана, см. sprint 05). Разброс цен/категорий/валют — правдоподобный, но придуманный. Заменить, когда реальное распределение будет готово.

# Balance Lab — profiles / reports (движок симуляции)

`profiles/*.json` — модели поведения игроков (не события поштучно). Формат:
```json
{
  "id": "casual", "name": "...", "description": "...",
  "roles": ["achiever"],           // свободные теги, для мышления о разных типах игроков, не структурный параметр
  "playFrequencyDays": 3,          // играет раз в N дней
  "simulateDays": 90,
  "avgWorkRating": 450,            // фиксированный статус игрока → бакет ранга (server_ranks.csv), рейтинг НЕ эволюционирует
  "events": [                       // плоский упорядоченный список, выполняется каждый игровой день
    { "type": "arenaSubmit" },
    { "type": "arenaSubmit", "boost": 1, "chance": 0.4 },   // chance — вероятность события в этот день (по умолчанию 1)
    { "type": "watchAd", "count": 3 },
    { "type": "dailyTask", "taskType": "arena" },
    { "type": "buyContent", "currency": "coins", "priority": ["styles","tools","extra"] },
    { "type": "buyPremiumCar", "chance": 0.1 }
  ],
  "currencyRefill": { "enabled": true, "coinsSlot": "pocketcoins", "gemsSlot": "pinchgems" }
}
```
Условное событие — ровно одно: докупка валюты (`currencyRefill`), срабатывает автоматически, когда не хватает на покупку/буст, а не по расписанию.

`reports/*.json` — пересчитываются кнопкой «▶ Запустить симуляцию всех профилей» во вкладке «Профили» (нужно один раз открыть проект целиком — кнопка в шапке, грант на папку `balance-lab`, дальше `data/profiles/reports` находятся сами). Каждый отчёт: вехи (день открытия ПРО/всех стилей/апдейтов/исчерпания контента), $ потрачено, $ отдано рекламой и монетами (по лучшему курсу из `static_prices.csv`, та же методика, что в [[../../DisDocs/sprints/баланс-и-монетизация]]), финальное состояние, компактный trace значимых событий (не полный дневной лог — для отладки).

Движок и рендер отчётов проверены на моках (3 тестовых профиля, реальные конфиги) — цифры получаются логичные, включая первую находку: casual-профиль почти не взаимодействует с магазином при текущих ценах/доходах.
