"""
Собирает все метрики в один markdown-отчёт: Analytics/reports/report-<дата>.md

Запуск:
    cd Analytics/Scripts
    python3 build_report.py
"""
import datetime
from pathlib import Path

import metric_installs as mi
import metric_marketing as mm
import metric_retention as mr
import metric_revenue as mrev
from lib import to_markdown_table

REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"


def build() -> str:
    today = datetime.date.today().isoformat()
    parts = [f"# Отчёт по аналитике — {today}\n"]
    parts.append(
        "_Сгенерировано автоматически скриптом `Analytics/Scripts/build_report.py` "
        "из локальных копий дампов БД (`Analytics/data/`). Перезапускайте после "
        "каждой новой выгрузки дампов, чтобы обновить цифры._\n"
    )

    parts.append("## Установки\n")
    parts.append("### По месяцам\n")
    parts.append(to_markdown_table(mi.installs_by_month()))
    parts.append("\n### По месяцам и платформам\n")
    parts.append(to_markdown_table(mi.installs_by_month_and_platform()))
    parts.append("\n### Всего устройств по платформам (за всё время)\n")
    parts.append(to_markdown_table(mi.installs_by_platform()))

    parts.append("\n## Доход (реальные деньги: paidItems, fake=0, paid+credits)\n")
    total = mrev.revenue_total()
    gap = mrev.last_transaction_gap_days()
    parts.append(f"**Всего за всё время: ${total:.2f}. Дней с последней реальной транзакции: {gap}.**\n")
    parts.append("\n### По месяцам\n")
    parts.append(to_markdown_table(mrev.revenue_by_month()))
    parts.append("\n### ARPU/ARPPU по месяцам (активные — по startSession)\n")
    parts.append(to_markdown_table(mrev.paying_users_vs_active_users_by_month()))
    parts.append("\n### По продуктам\n")
    parts.append(to_markdown_table(mrev.revenue_by_product()))

    parts.append("\n## Ретеншен\n")
    parts.append(
        "Сигнал активности — `stat.startSession` (см. docstring `metric_retention.py` "
        "про то, почему не `timePoint`).\n"
    )
    parts.append("\n### D1/D7/D30 (по всей базе)\n")
    parts.append(to_markdown_table(mr.day_n_retention()))
    parts.append("\n### Помесячный когортный ретеншен (M0→M1→M2→M3)\n")
    parts.append(to_markdown_table(mr.monthly_cohort_retention()))

    parts.append("\n## Маркетинг\n")
    parts.append("### Клики по платформам (всего)\n")
    parts.append(to_markdown_table(mm.clicks_by_platform()))
    parts.append("\n### Клики по месяцам и платформам\n")
    parts.append(to_markdown_table(mm.clicks_by_month_and_platform()))
    parts.append("\n### Топ ссылок\n")
    parts.append(to_markdown_table(mm.top_link_codes()))
    parts.append("\n### Рост листа ожидания (early access emails)\n")
    parts.append(to_markdown_table(mm.early_access_emails_by_month()))

    return "\n".join(parts) + "\n"


if __name__ == "__main__":
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    content = build()
    out_path = REPORTS_DIR / f"report-{datetime.date.today().isoformat()}.md"
    out_path.write_text(content, encoding="utf-8")
    print(f"Отчёт записан: {out_path}")
