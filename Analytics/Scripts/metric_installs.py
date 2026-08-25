"""Установки (регистрации) по месяцам и платформам."""
from lib import query

OS_TYPE_LABELS = {
    "8": "iOS",
    "11": "Android",
    "0": "неизвестно/веб",
}


def installs_by_month() -> "pd.DataFrame":
    return query(
        """
        SELECT DATE_FORMAT(registerTime, '%Y-%m') AS month,
               COUNT(*) AS installs
        FROM users
        GROUP BY month
        ORDER BY month
        """
    )


def installs_by_platform() -> "pd.DataFrame":
    df = query(
        """
        SELECT osType, COUNT(*) AS devices
        FROM devices
        GROUP BY osType
        ORDER BY devices DESC
        """
    )
    df["osType"] = df["osType"].astype("Int64").astype(str)
    df["platform"] = df["osType"].map(OS_TYPE_LABELS).fillna(df["osType"])
    return df[["platform", "devices"]]


def installs_by_month_and_platform() -> "pd.DataFrame":
    df = query(
        """
        SELECT DATE_FORMAT(u.registerTime, '%Y-%m') AS month,
               d.osType,
               COUNT(*) AS installs
        FROM users u
        JOIN devices d ON d.userId = u.userId
        GROUP BY month, d.osType
        ORDER BY month
        """
    )
    df["osType"] = df["osType"].astype("Int64").astype(str)
    df["platform"] = df["osType"].map(OS_TYPE_LABELS).fillna(df["osType"])
    pivot = df.pivot_table(index="month", columns="platform", values="installs", aggfunc="sum", fill_value=0)
    pivot["total"] = pivot.sum(axis=1)
    return pivot.reset_index()


if __name__ == "__main__":
    print("=== Установки по месяцам ===")
    print(installs_by_month().to_string(index=False))
    print("\n=== Установки по платформам (всего устройств) ===")
    print(installs_by_platform().to_string(index=False))
    print("\n=== Установки по месяцам и платформам ===")
    print(installs_by_month_and_platform().to_string(index=False))
