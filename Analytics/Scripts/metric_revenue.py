"""
Доход по реальным транзакциям (paidItems, fake=0, currency=3 — реальные деньги).

itemType:
  'paid'    — прямая покупка (PRO/workshop, апгрейды стилей)
  'credits' — покупка твёрдой валюты (монеты/кристаллы) за реальные деньги
  'soft'    — трата игровой (не реальной) валюты внутри игры — НЕ доход, исключаем
fake=1     — тестовые транзакции разработчика (все до 2024-08), исключаем
"""
import pandas as pd

from lib import query

REVENUE_WHERE = "fake = 0 AND itemType IN ('paid', 'credits')"


def revenue_by_month() -> "pd.DataFrame":
    return query(
        f"""
        SELECT DATE_FORMAT(created, '%Y-%m') AS month,
               COUNT(*) AS transactions,
               COUNT(DISTINCT userId) AS paying_users,
               SUM(price) AS revenue_usd
        FROM paidItems
        WHERE {REVENUE_WHERE}
        GROUP BY month
        ORDER BY month
        """
    )


def revenue_total() -> float:
    df = query(f"SELECT SUM(price) AS revenue_usd FROM paidItems WHERE {REVENUE_WHERE}")
    return float(df["revenue_usd"].iloc[0])


def revenue_by_product() -> "pd.DataFrame":
    return query(
        f"""
        SELECT productId, itemId, COUNT(*) AS n, SUM(price) AS revenue_usd,
               MIN(created) AS first_sale, MAX(created) AS last_sale
        FROM paidItems
        WHERE {REVENUE_WHERE}
        GROUP BY productId, itemId
        ORDER BY revenue_usd DESC
        """
    )


def paying_users_vs_active_users_by_month() -> "pd.DataFrame":
    """ARPU/ARPPU: доход к активным пользователям месяца (по startSession) и к платящим.

    Не используем timePoint для "активных" — это в основном лог шагов обучения
    на первой сессии, а не общая активность (см. metric_retention.py).
    """
    revenue = revenue_by_month()
    active = query(
        """
        SELECT DATE_FORMAT(created, '%Y-%m') AS month,
               COUNT(DISTINCT userId) AS active_users
        FROM startSession
        GROUP BY month
        ORDER BY month
        """,
        db="carproject_stat",
    )
    df = revenue.merge(active, on="month", how="outer").fillna(0).sort_values("month")
    df["revenue_usd"] = df["revenue_usd"].astype(float)
    df["active_users"] = df["active_users"].astype(float)
    df["paying_users"] = df["paying_users"].astype(float)
    df["arpu"] = (df["revenue_usd"] / df["active_users"].replace(0, float("nan"))).round(3)
    df["arppu"] = (df["revenue_usd"] / df["paying_users"].replace(0, float("nan"))).round(2)
    return df


def last_transaction_gap_days() -> int:
    """Сколько дней прошло с последней реальной транзакции — индикатор 'монетизация встала'."""
    import datetime

    df = query(f"SELECT MAX(created) AS last_dt FROM paidItems WHERE {REVENUE_WHERE}")
    last_dt = pd.to_datetime(df["last_dt"].iloc[0])
    return (datetime.datetime.now() - last_dt).days


if __name__ == "__main__":
    print("=== Доход по месяцам (реальные деньги) ===")
    print(revenue_by_month().to_string(index=False))
    print(f"\nВсего за всё время: ${revenue_total():.2f}")
    print(f"Дней с последней реальной транзакции: {last_transaction_gap_days()}")
    print("\n=== Доход по продуктам ===")
    print(revenue_by_product().to_string(index=False))
    print("\n=== ARPU/ARPPU по месяцам ===")
    print(paying_users_vs_active_users_by_month().to_string(index=False))
