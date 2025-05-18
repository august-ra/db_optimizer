import React, { useEffect, useState } from "react"

import "./App.css"

import { getSourceParts, makeSQLByTemplate, tableTmp } from "../utils/make_sql"
import type { Operation } from "../utils/make_sql"


export default function App() {
  const [operation, setOperation] = useState<Operation>("delete")
  const [source,    setSource   ] = useState<string>("")
  const [sqlText,   setSQLText  ] = useState<string>("")

  useEffect(() => setSource(tableTmp), [])

  useEffect(() => {
    const [tableName, fields] = getSourceParts(source)

    setSQLText(makeSQLByTemplate(tableName, fields, operation))
  }, [source, operation])

  function onSourceChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setSource(event.target.value)
  }

  function onOperationChange(event: React.ChangeEvent<HTMLInputElement>) {
    const operation = event.target.value as Operation

    if (operation === "select" && event.target.checked || operation === "delete" && !event.target.checked)
      setOperation("select")
    else
      setOperation("delete")
  }

  return (
    <div className="app">
      <div>
        <div className="top left">
          <label htmlFor="source">
            Описание таблицы:
          </label>

          <div>
            <span className="operations">Результат как:</span>

            <label>
              <input type="radio" name="operation" value="select"
                     checked={operation === "select"} onChange={onOperationChange} />&nbsp;
              <span>SELECT</span>
            </label>

            <label>
              <input type="radio" name="operation" value="delete"
                     checked={operation === "delete"} onChange={onOperationChange} />&nbsp;
              <span>DELETE</span>
            </label>
          </div>
        </div>

        <textarea className="left" id="source" value={source} onChange={onSourceChange} />
      </div>

      <label className="top right">
        Запрос Transact-SQL:
        <br />
        <textarea className="right" value={sqlText} />
      </label>
    </div>
  )
}
