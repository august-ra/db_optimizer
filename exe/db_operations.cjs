
// for Node.js

const fs = require("node:fs/promises")
const path = require("path")
const mssql = require("mssql")

const config = {
  user:     process.env.USER_NAME,
  password: process.env.USER_PASSWORD,
  server:   process.env.SERVER_IP,
  port:     Number(process.env.SERVER_PORT) || 1433,
  database: process.env.DATABASE_NAME,
  requestTimeout: 600000,
  options: {
    encrypt: true,               // В зависимости от конфигурации сервера
    trustServerCertificate: true // Для self-signed сертификатов
  }
}

const dataProcess = {
  date:  null,
  index: null,

  init() {
    const now = new Date()
    now.setHours(24, 0, 0, 0)

    this.date  = now
    this.index = 3
  },

  doNextStep() {
    --this.index
    this.date.setDate(this.date.getDate() - 1)
  },

  decodeItsDate() {
    const parts = {
      year:  this.date.getFullYear(),
      month: this.date.getMonth() + 1,
      day:   this.date.getDate(),
      text:  "",
    }

    parts.text = this.formatDate(parts)

    return parts
  },

  formatDate: (parts) => `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

async function deleteSameBatches() {
  dataProcess.init()

  try {
    await mssql.connect(config)

    await Promise.resolve()
      .then(() =>
        fs.readFile(path.resolve(__dirname, "query_table_1.sql"), { encoding: "utf8" })
      )
      .then((text) =>
        makeDaysLoop(text)
      )
      .catch(() => {
        console.log("Stopped because of error...\n")
      }
    )
  } catch (err) {
    console.error("Ошибка:", err)
  } finally {
    await mssql.close()
  }
}

async function makeDaysLoop(delete_sql) {
  while (dataProcess.index > 0) {
    console.log(dataProcess.date.toISOString())

    const date2 = dataProcess.decodeItsDate()

    dataProcess.doNextStep()

    const date1 = dataProcess.decodeItsDate()

    const text = `
      DECLARE @date_1 datetime2 = '${date1.text} 00:00:00'
      DECLARE @date_2 datetime2 = '${date2.text} 08:00:00'
      ;
      ${delete_sql}
    `

    const result = await mssql.query(text)

    console.log(date1.text, " ==> ", result.rowsAffected[2])
    console.log("")
  }
}

deleteSameBatches()
  .then(() => console.log("Finished!"))
