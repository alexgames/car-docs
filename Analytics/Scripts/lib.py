"""
Общий помощник для запуска SQL-запросов к локальным базам проекта через MySQL CLI.

Базы разворачиваются локально командой:
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS carproject_3dl CHARACTER SET utf8mb4;"
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS carproject_stat CHARACTER SET utf8mb4;"
    mysql -u root carproject_3dl  < Analytics/data/<дата>/cy74408_3dl.sql
    mysql -u root carproject_stat < Analytics/data/<дата>/cy74408_stat.sql

Кросс-базовые джойны работают напрямую (carproject_3dl.users JOIN carproject_stat.timePoint),
т.к. обе базы подняты на одном сервере MySQL.
"""
import io
import subprocess

import pandas as pd

MYSQL_USER = "root"


def query(sql: str, db: str = "carproject_3dl") -> pd.DataFrame:
    """Выполняет SQL и возвращает результат как DataFrame (через `mysql -B`, tab-separated)."""
    result = subprocess.run(
        ["mysql", "-u", MYSQL_USER, "-B", db, "-e", sql],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"MySQL error:\n{result.stderr}\nSQL:\n{sql}")
    if not result.stdout.strip():
        return pd.DataFrame()
    return pd.read_csv(io.StringIO(result.stdout), sep="\t")


def to_markdown_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "_нет данных_\n"
    return df.to_markdown(index=False)
