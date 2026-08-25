"""Маркетинг: клики по коротким ссылкам (соцсети) и рост листа ожидания Android."""
from lib import query


def clicks_by_platform() -> "pd.DataFrame":
    return query(
        """
        SELECT platform, COUNT(*) AS clicks
        FROM clicks
        GROUP BY platform
        ORDER BY clicks DESC
        """,
        db="carproject_stat",
    )


def clicks_by_month_and_platform() -> "pd.DataFrame":
    df = query(
        """
        SELECT DATE_FORMAT(timestamp, '%Y-%m') AS month, platform, COUNT(*) AS clicks
        FROM clicks
        GROUP BY month, platform
        ORDER BY month
        """,
        db="carproject_stat",
    )
    pivot = df.pivot_table(index="month", columns="platform", values="clicks", aggfunc="sum", fill_value=0)
    pivot["total"] = pivot.sum(axis=1)
    return pivot.reset_index()


def top_link_codes(limit: int = 15) -> "pd.DataFrame":
    return query(
        f"""
        SELECT link_code, COUNT(*) AS clicks, MIN(timestamp) AS first_click, MAX(timestamp) AS last_click
        FROM clicks
        GROUP BY link_code
        ORDER BY clicks DESC
        LIMIT {limit}
        """,
        db="carproject_stat",
    )


def early_access_emails_by_month() -> "pd.DataFrame":
    df = query(
        """
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS new_emails
        FROM early_access_emails
        GROUP BY month
        ORDER BY month
        """,
        db="carproject_stat",
    )
    df["cumulative"] = df["new_emails"].cumsum()
    return df


if __name__ == "__main__":
    print("=== Клики по платформам (всего) ===")
    print(clicks_by_platform().to_string(index=False))
    print("\n=== Клики по месяцам и платформам ===")
    print(clicks_by_month_and_platform().to_string(index=False))
    print("\n=== Топ ссылок по кликам ===")
    print(top_link_codes().to_string(index=False))
    print("\n=== Рост листа ожидания (early access emails) ===")
    print(early_access_emails_by_month().to_string(index=False))
