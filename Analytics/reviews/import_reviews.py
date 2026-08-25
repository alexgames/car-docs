import csv
import json
import time
import requests

# ID вашего приложения (6478308548)
APP_ID = "6478308548"

# Полный официальный список кодов стран App Store (175 регионов)
COUNTRIES = [
    "ae", "af", "ag", "ai", "al", "am", "ao", "ar", "as", "at", "au", "az", 
    "ba", "bb", "be", "bf", "bg", "bh", "bi", "bj", "bm", "bn", "bo", "br", 
    "bs", "bt", "bw", "by", "bz", "ca", "cd", "cf", "cg", "ch", "ci", "cl", 
    "cm", "cn", "co", "cr", "cv", "cy", "cz", "de", "dj", "dk", "dm", "do", 
    "dz", "ec", "ee", "eg", "er", "es", "et", "fi", "fj", "fm", "fr", "ga", 
    "gb", "gd", "ge", "gh", "gi", "gl", "gm", "gn", "gq", "gr", "gt", "gw", 
    "gy", "hk", "hn", "hr", "hu", "id", "ie", "il", "in", "iq", "is", "it", 
    "jm", "jo", "jp", "ke", "kg", "kh", "ki", "km", "kn", "kr", "kw", "ky", 
    "kz", "la", "lb", "lc", "li", "lk", "lr", "ls", "lt", "lu", "lv", "ly", 
    "ma", "mc", "md", "me", "mg", "mh", "mk", "ml", "mm", "mn", "mo", "mp", 
    "mr", "ms", "mt", "mu", "mv", "mw", "mx", "my", "mz", "na", "ne", "ng", 
    "ni", "nl", "no", "np", "nr", "nz", "om", "pa", "pe", "pg", "ph", "pk", 
    "pl", "pt", "pw", "py", "qa", "ro", "rs", "ru", "rw", "sa", "sb", "sc", 
    "se", "sg", "si", "sk", "sl", "sm", "sn", "so", "sr", "st", "sv", "sz", 
    "tc", "td", "tg", "th", "tj", "tm", "tn", "to", "tr", "tt", "tv", "tw", 
    "tz", "ua", "ug", "us", "uy", "uz", "vc", "ve", "vg", "vn", "vu", "ws", 
    "xk", "ye", "za", "zm", "zw"
]

all_reviews = []

print(f"🚀 Начинается сбор отзывов для приложения ID: {APP_ID}")
print(f"🌍 Всего стран для проверки: {len(COUNTRIES)}")
print("-" * 50)

for index, country in enumerate(COUNTRIES, 1):
    # ЗДЕСЬ ИСПРАВЛЕНО: Добавлен слэш / перед {country}
    url = f"https://apple.com/{country}/rss/customerreviews/id={APP_ID}/sortBy=mostRecent/json"
    
    try:
        # Имитируем реальный браузер в заголовках, чтобы избежать блокировок
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        
        # Если страны нет или у нее нет отзывов, Apple может вернуть 400 или 404
        if response.status_code != 200:
            print(f"[{index}/{len(COUNTRIES)}] [{country.upper()}] Отзывы отсутствуют или регион недоступен (Код: {response.status_code})")
            continue
            
        try:
            data = response.json()
        except json.JSONDecodeError:
            print(f"[{index}/{len(COUNTRIES)}] [{country.upper()}] Не удалось прочитать JSON-ответ")
            continue
            
        feed = data.get("feed", {})
        entries = feed.get("entry", [])
        
        if not entries:
            print(f"[{index}/{len(COUNTRIES)}] [{country.upper()}] Нет новых отзывов")
            continue
            
        # Если в стране ровно 1 отзыв, Apple присылает словарь вместо списка
        if isinstance(entries, dict):
            entries = [entries]
            
        # Считаем количество добавленных отзывов (первый элемент фида — это инфо о приложении, его пропускаем)
        country_reviews_count = 0
        if len(entries) > 1:
            for entry in entries[1:]:
                all_reviews.append({
                    "Country": country.upper(),
                    "Date": entry.get("updated", {}).get("label", "N/A"),
                    "Author": entry.get("author", {}).get("name", {}).get("label", "Anonymous"),
                    "Rating": entry.get("im:rating", {}).get("label", "0"),
                    "Title": entry.get("title", {}).get("label", ""),
                    "Review": entry.get("content", {}).get("label", "")
                })
                country_reviews_count += 1
                
        print(f"[{index}/{len(COUNTRIES)}] [{country.upper()}] Успешно! Собрано отзывов: {country_reviews_count}")
        
        # Пауза в 0.4 секунды между запросами для стабильности
        time.sleep(0.4)
        
    except requests.exceptions.RequestException as e:
        print(f"[{index}/{len(COUNTRIES)}] [{country.upper()}] Ошибка сети: {e}")
        time.sleep(2) # Если сеть моргнула, ждем чуть дольше

print("-" * 50)

# Сохранение результатов в файл
if all_reviews:
    output_file = "appstore_all_reviews.csv"
    try:
        # Используем utf-8-sig, чтобы Excel в Windows корректно отображал эмодзи и кириллицу
        with open(output_file, mode="w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["Country", "Date", "Author", "Rating", "Title", "Review"])
            writer.writeheader()
            writer.writerows(all_reviews)
        print(f"🎉 Сбор завершен! Всего найдено отзывов по миру: {len(all_reviews)}")
        print(f"💾 Данные сохранены в файл: {output_file}")
    except Exception as e:
        print(f"❌ Ошибка при записи файла: {e}")
else:
    print("ℹ️ Скрипт отработал, но для данного ID приложения не найдено ни одного отзыва ни в одной стране.")
