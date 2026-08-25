"""
Ретеншен.

Используем таблицу stat.startSession как сигнал активности.
ВАЖНО: stat.timePoint при почти том же объёме на самом деле логирует в основном
шаги обучения/воронки на 1-й сессии (поле location/subLocation) — распределение
почти 1-в-1 повторяет новые регистрации месяца и почти не показывает возвраты
(проверено: только 71 пользователь из 6289 имеет timePoint-событие после дня
регистрации, тогда как startSession — 1026). Поэтому для ретеншена используем
startSession, а не timePoint.

Два среза:
1. Классический D1/D7/D30 по дням — % пользователей, у которых была активность
   ровно на N-й день после регистрации (день регистрации = день 0).
2. Помесячный когортный ретеншен — % пользователей когорты (месяц регистрации),
   у которых была активность в месяц+1, месяц+2, месяц+3 (более устойчиво на
   разреженных данных старых когорт).
"""
import pandas as pd

from lib import query


def day_n_retention() -> pd.DataFrame:
    sql = """
        SELECT u.userId,
               DATE(u.registerTime) AS install_date,
               DATEDIFF(DATE(s.created), DATE(u.registerTime)) AS day_offset
        FROM carproject_3dl.users u
        JOIN carproject_stat.startSession s ON s.userId = u.userId
        WHERE DATEDIFF(DATE(s.created), DATE(u.registerTime)) IN (0, 1, 7, 30)
        GROUP BY u.userId, install_date, day_offset
    """
    df = query(sql, db="carproject_3dl")
    if df.empty:
        return df
    total_users = query(
        "SELECT COUNT(*) AS n FROM users", db="carproject_3dl"
    )["n"].iloc[0]
    rows = []
    for day in (1, 7, 30):
        active = df[df["day_offset"] == day]["userId"].nunique()
        d0 = df[df["day_offset"] == 0]["userId"].nunique()
        rows.append(
            {
                "day": f"D{day}",
                "active_users": active,
                "d0_base_users": d0,
                "retention_%_of_d0": round(100 * active / d0, 1) if d0 else None,
                "retention_%_of_all_installs": round(100 * active / total_users, 2),
            }
        )
    return pd.DataFrame(rows)


def monthly_cohort_retention() -> pd.DataFrame:
    sql = """
        SELECT u.userId,
               DATE_FORMAT(u.registerTime, '%Y-%m') AS cohort_month,
               PERIOD_DIFF(DATE_FORMAT(s.created, '%Y%m'), DATE_FORMAT(u.registerTime, '%Y%m')) AS month_offset
        FROM carproject_3dl.users u
        JOIN carproject_stat.startSession s ON s.userId = u.userId
        WHERE PERIOD_DIFF(DATE_FORMAT(s.created, '%Y%m'), DATE_FORMAT(u.registerTime, '%Y%m')) BETWEEN 0 AND 3
        GROUP BY u.userId, cohort_month, month_offset
    """
    df = query(sql, db="carproject_3dl")
    if df.empty:
        return df
    cohort_size = df[df["month_offset"] == 0].groupby("cohort_month")["userId"].nunique()
    pivot = df.pivot_table(
        index="cohort_month", columns="month_offset", values="userId", aggfunc="nunique", fill_value=0
    )
    pivot = pivot.rename(columns={0: "M0_active", 1: "M1_active", 2: "M2_active", 3: "M3_active"})
    pivot["cohort_size_M0"] = cohort_size
    for m in (1, 2, 3):
        col = f"M{m}_active"
        if col in pivot.columns:
            pivot[f"M{m}_retention_%"] = (100 * pivot[col] / pivot["cohort_size_M0"]).round(1)
    return pivot.reset_index().sort_values("cohort_month")


if __name__ == "__main__":
    print("=== D1/D7/D30 ретеншен (по всей базе, все когорты вместе) ===")
    print(day_n_retention().to_string(index=False))
    print("\n=== Помесячный когортный ретеншен ===")
    print(monthly_cohort_retention().to_string(index=False))
