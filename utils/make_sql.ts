
export type Operation = "select" | "delete"

export function matchAllInBrackets(text: string): string[] {
  // @ts-ignore
  return [...text.matchAll(/\[([^\[\]]*)\]/g)]
}

export function getSourceParts(source: string): [string,  string[]] {
  let tableName: string   = ""
  let fields:    string[] = []

  const lines: string[] = source.split("\n").map((line) => line.trim())

  for (const line of lines) {
    if (tableName === "") {
      matchAllInBrackets(line).map((m: string) => {
        tableName = m[1].trim()
        return tableName
      })

      if (tableName === "")
        tableName = line.trim()

      continue
    }

    const field: string = matchAllInBrackets(line).map((m) => m[1].trim())[0]

    if (!field || field === "Id" || field === "DATE_DOWN")
      continue

    fields.push(field)
  }

  return [tableName, fields]
}

export function makeSQLByTemplate(tableName: string, fields: string[], operation: Operation): string {
  return `WITH [tmp_subtables] AS (
  -- выбираем строки исходной таблицы для обработки
  SELECT TOP (1000000)
      ROW_NUMBER() OVER (PARTITION BY [DATE_DOWN] ORDER BY [Id]) AS ROW_NUM
      , DENSE_RANK() OVER (ORDER BY [DATE_DOWN] desc) AS DATE_NUM
      , [DATE_DOWN]
${fields.map((field) => `      , [${field}]`).join("\n")}
    FROM [dbo].[${tableName}]
    WHERE [DATE_DOWN] > @date_1 and [DATE_DOWN] < @date_2
    ORDER BY [DATE_DOWN] desc, [ROW_NUM]
)
, [tmp_dates] AS (
  -- выбираем различные даты
  SELECT DISTINCT
      [DATE_NUM]
      , [DATE_DOWN]
    FROM [tmp_subtables]
)
, [tmp_compares] AS (
  -- делаем таблицу пар сравнения строк по соседним датам
  SELECT DISTINCT
      0 AS ROW_NUM
      , '=====' AS d1
      , (SELECT COUNT(*) FROM [tmp_subtables] AS tt WHERE tt.[DATE_DOWN] = t1.[DATE_DOWN]) AS T1_COUNT
      , t1.[DATE_NUM] AS T1_DATE_NUM
      , t1.[DATE_DOWN] AS T1_DATE_DOWN
${fields.map((field) => `      , NULL AS T1_${field}`).join("\n")}
      , '=====' AS d2
      , (SELECT COUNT(*) FROM [tmp_subtables] AS tt WHERE tt.[DATE_DOWN] = t2.[DATE_DOWN]) AS T2_COUNT
      , t2.[DATE_NUM] AS T2_DATE_NUM
      , t2.[DATE_DOWN] AS T2_DATE_DOWN
${fields.map((field) => `      , NULL AS T2_${field}`).join("\n")}
    FROM [tmp_dates] AS t1
      INNER JOIN [tmp_dates] AS t2
      ON t1.DATE_NUM = t2.DATE_NUM - 1
  UNION ALL
  SELECT
      t1.ROW_NUM
      , '====='
      , 0
      , t1.[DATE_NUM]
      , t1.[DATE_DOWN]
${fields.map((field) => `      , t1.[${field}]`).join("\n")}
      , '====='
      , 0
      , t2.[DATE_NUM]
      , t2.[DATE_DOWN]
${fields.map((field) => `      , t2.[${field}]`).join("\n")}
    FROM [tmp_subtables] as t1
      FULL JOIN [tmp_subtables] as t2
      ON t1.DATE_NUM = t2.DATE_NUM - 1
       and t1.ROW_NUM = t2.ROW_NUM
    WHERE ${fields.map((field) => `t1.[${field}] != t2.[${field}]`).join("\n       or ")}
)
, [tmp_result] AS (
  -- ${(operation === "select"
      ? `выбираем пары c различиями в строках/колонках пакетов`
      : `выбираем пары без различий (полные повторы по пакету строк и колонков них)`
  )}
  SELECT
      *
    FROM (
      SELECT DISTINCT
          t_left.[DATE_DOWN]
          , COUNT(t_right.[ROW_NUM]) OVER (PARTITION BY [DATE_DOWN]) - 1 AS mark
          , t_right.*
        FROM [tmp_dates] AS t_left
          INNER JOIN [tmp_compares] AS t_right
          ON t_left.[DATE_DOWN] = t_right.T1_DATE_DOWN
    ) AS tt
   ${(operation === "select"
      ? `
   -- WHERE [mark] = 0 and (not T1_COUNT = T2_COUNT or T1_COUNT = 0 or T2_COUNT = 0)
   -- WHERE [mark] = 0 and T1_COUNT = T2_COUNT and T1_COUNT > 0 and T2_COUNT > 0
    WHERE not [mark] = 0
)
SELECT
    *
  FROM [tmp_result]
  ORDER BY [DATE_DOWN] desc
    , [ROW_NUM]
;
`
      : `
   -- WHERE [mark] = 0 and (not T1_COUNT = T2_COUNT or T1_COUNT = 0 or T2_COUNT = 0)
    WHERE [mark] = 0 and T1_COUNT = T2_COUNT and T1_COUNT > 0 and T2_COUNT > 0
   -- WHERE not [mark] = 0
)
DELETE FROM [dbo].[${tableName}]
  WHERE [DATE_DOWN] in (SELECT [DATE_DOWN] FROM [tmp_result])
;
`
  ).trimStart()}
`
}

// the example of table description
export const tableTmp: string =
`[dbo].[xls_accounts_receivable]
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
`

// the example of DELETE query
const exampleDELETE: string = `
WITH [tmp_subtables] AS (
  -- выбираем строки исходной таблицы для обработки
  SELECT TOP (1000000)
      ROW_NUMBER() OVER (PARTITION BY [DATE_DOWN] ORDER BY [Id]) AS ROW_NUM
      , DENSE_RANK() OVER (ORDER BY [DATE_DOWN] desc) AS DATE_NUM
      , [DATE_DOWN]
      , [uniq_num]
      , [fio_client]
      , [ddu]
      , [ddu_sum]
      , [paid]
      , [balance_owed]
      , [sum_receivable]
      , [id_project]
      , [type_property]
      , [booking_date]
      , [booking_num]
      , [ddu_date]
      , [area]
      , [booking_sum]
      , [ddu_type]
      , [ddu_date_sign]
      , [status]
    FROM [dbo].[xls_accounts_receivable]
    WHERE [DATE_DOWN] > @date_1 and [DATE_DOWN] < @date_2
    ORDER BY [DATE_DOWN] desc, [ROW_NUM]
)
, [tmp_dates] AS (
  -- выбираем различные даты
  SELECT DISTINCT
      [DATE_NUM]
      , [DATE_DOWN]
    FROM [tmp_subtables]
)
, [tmp_compares] AS (
  -- делаем таблицу пар сравнения строк по соседним датам
  SELECT DISTINCT
      0 AS ROW_NUM
      , '=====' AS d1
      , (SELECT COUNT(*) FROM [tmp_subtables] AS tt WHERE tt.[DATE_DOWN] = t1.[DATE_DOWN]) AS T1_COUNT
      , t1.[DATE_NUM] AS T1_DATE_NUM
      , t1.[DATE_DOWN] AS T1_DATE_DOWN
      , NULL AS T1_uniq_num
      , NULL AS T1_fio_client
      , NULL AS T1_ddu
      , NULL AS T1_ddu_sum
      , NULL AS T1_paid
      , NULL AS T1_balance_owed
      , NULL AS T1_sum_receivable
      , NULL AS T1_id_project
      , NULL AS T1_type_property
      , NULL AS T1_booking_date
      , NULL AS T1_booking_num
      , NULL AS T1_ddu_date
      , NULL AS T1_area
      , NULL AS T1_booking_sum
      , NULL AS T1_ddu_type
      , NULL AS T1_ddu_date_sign
      , NULL AS T1_status
      , '=====' AS d2
      , (SELECT COUNT(*) FROM [tmp_subtables] AS tt WHERE tt.[DATE_DOWN] = t2.[DATE_DOWN]) AS T2_COUNT
      , t2.[DATE_NUM] AS T2_DATE_NUM
      , t2.[DATE_DOWN] AS T2_DATE_DOWN
      , NULL AS T2_uniq_num
      , NULL AS T2_fio_client
      , NULL AS T2_ddu
      , NULL AS T2_ddu_sum
      , NULL AS T2_paid
      , NULL AS T2_balance_owed
      , NULL AS T2_sum_receivable
      , NULL AS T2_id_project
      , NULL AS T2_type_property
      , NULL AS T2_booking_date
      , NULL AS T2_booking_num
      , NULL AS T2_ddu_date
      , NULL AS T2_area
      , NULL AS T2_booking_sum
      , NULL AS T2_ddu_type
      , NULL AS T2_ddu_date_sign
      , NULL AS T2_status
    FROM [tmp_dates] AS t1
      INNER JOIN [tmp_dates] AS t2
      ON t1.DATE_NUM = t2.DATE_NUM - 1
  UNION ALL
  SELECT
      t1.ROW_NUM
      , '====='
      , 0
      , t1.[DATE_NUM]
      , t1.[DATE_DOWN]
      , t1.[uniq_num]
      , t1.[fio_client]
      , t1.[ddu]
      , t1.[ddu_sum]
      , t1.[paid]
      , t1.[balance_owed]
      , t1.[sum_receivable]
      , t1.[id_project]
      , t1.[type_property]
      , t1.[booking_date]
      , t1.[booking_num]
      , t1.[ddu_date]
      , t1.[area]
      , t1.[booking_sum]
      , t1.[ddu_type]
      , t1.[ddu_date_sign]
      , t1.[status]
      , '====='
      , 0
      , t2.[DATE_NUM]
      , t2.[DATE_DOWN]
      , t2.[uniq_num]
      , t2.[fio_client]
      , t2.[ddu]
      , t2.[ddu_sum]
      , t2.[paid]
      , t2.[balance_owed]
      , t2.[sum_receivable]
      , t2.[id_project]
      , t2.[type_property]
      , t2.[booking_date]
      , t2.[booking_num]
      , t2.[ddu_date]
      , t2.[area]
      , t2.[booking_sum]
      , t2.[ddu_type]
      , t2.[ddu_date_sign]
      , t2.[status]
    FROM [tmp_subtables] as t1
      FULL JOIN [tmp_subtables] as t2
      ON t1.DATE_NUM = t2.DATE_NUM - 1
       and t1.ROW_NUM = t2.ROW_NUM
    WHERE t1.[uniq_num] != t2.[uniq_num]
       or t1.[fio_client] != t2.[fio_client]
       or t1.[ddu] != t2.[ddu]
       or t1.[ddu_sum] != t2.[ddu_sum]
       or t1.[paid] != t2.[paid]
       or t1.[balance_owed] != t2.[balance_owed]
       or t1.[sum_receivable] != t2.[sum_receivable]
       or t1.[id_project] != t2.[id_project]
       or t1.[type_property] != t2.[type_property]
       or t1.[booking_date] != t2.[booking_date]
       or t1.[booking_num] != t2.[booking_num]
       or t1.[ddu_date] != t2.[ddu_date]
       or t1.[area] != t2.[area]
       or t1.[booking_sum] != t2.[booking_sum]
       or t1.[ddu_type] != t2.[ddu_type]
       or t1.[ddu_date_sign] != t2.[ddu_date_sign]
       or t1.[status] != t2.[status]
)
, [tmp_result] AS (
  -- выбираем пары без различий (полные повторы по пакету строк и колонков них)
  SELECT
      *
    FROM (
      SELECT DISTINCT
          t_left.[DATE_DOWN]
          , COUNT(t_right.[ROW_NUM]) OVER (PARTITION BY [DATE_DOWN]) - 1 AS mark
          , t_right.*
        FROM [tmp_dates] AS t_left
          INNER JOIN [tmp_compares] AS t_right
          ON t_left.[DATE_DOWN] = t_right.T1_DATE_DOWN
    ) AS tt
   -- WHERE [mark] = 0 and (not T1_COUNT = T2_COUNT or T1_COUNT = 0 or T2_COUNT = 0)
    WHERE [mark] = 0 and T1_COUNT = T2_COUNT and T1_COUNT > 0 and T2_COUNT > 0
   -- WHERE not [mark] = 0
)
DELETE FROM [dbo].[xls_accounts_receivable]
  WHERE [DATE_DOWN] in (SELECT [DATE_DOWN] FROM [tmp_result])
;
`
