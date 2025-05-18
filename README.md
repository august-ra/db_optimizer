# Генератор SQL из описания таблицы + запуск SQL

В репозитории две штуки:

### 1. Одностраничный сайт-генератор SQL.

Сайт генерирует запросы `SELECT` и `DELETE` на языке Transact-SQL из части описания таблицы:
* в первой строке имя таблицы в вариантах:
  * от `[DATABASE_NAME].[dbo].[table_name]` до `[table_name]` _(берём последнее имя)_
  * либо сразу `table_name` _(без спецсимволов)_;
* список полей с типами _(их не используем, просто чтобы не удалять)_.

Пример:
```tsql
[dbo].[xls_accounts_receivable]
  [Id] [int] IDENTITY(1,1) NOT NULL,
  [uniq_num] [nvarchar](50) NULL,
  [fio_client] [nvarchar](2048) NULL,
  [ddu] [nvarchar](50) NULL,
  [ddu_sum] [numeric](18, 2) NULL,
  [paid] [numeric](18, 2) NULL,
  [balance_owed] [numeric](18, 2) NULL,
  [sum_receivable] [numeric](18, 2) NULL,
  [id_project] [int] NULL,
  [type_property] [nvarchar](50) NULL,
  [booking_date] [datetime2](7) NULL,
  [booking_num] [nvarchar](50) NULL,
  [ddu_date] [datetime2](7) NULL,
  [area] [numeric](18, 2) NULL,
  [booking_sum] [numeric](18, 2) NULL,
  [DATE_DOWN] [datetime2](7) NULL,
  [ddu_type] [nvarchar](50) NULL,
  [ddu_date_sign] [datetime2](7) NULL,
  [status] [nvarchar](1024) NULL,
```

Сайт написан на React со сборщиком Vite.
При скачивании исходного кода этого репозитория необходимо установить пакеты `node_modules` посредством простой команды ```npm install```.

Для его запуска необходимо выполнить либо `npm run dev`, либо
```bash
    npm run build
    npm run preview
```

### 2. Модули запуска SQL на удаление дубликатов

Модули написаны на Node.js, и они выполняют запросы на языке Transact-SQL на удаление дублей.
Они используют библиотеку `mssql`.

Модули удаляют из таблиц(ы) дубли строк, получаемые при загрузке данных из файлов Excel.
Обрабатываются последние три дня включая текущий.
Запрос не хранит временных таблиц и работает на оконных функциях.

Для запуска модулей необходимо ввести в терминал команду:
* `node --env-file=.env exe/db_operations.cjs`
