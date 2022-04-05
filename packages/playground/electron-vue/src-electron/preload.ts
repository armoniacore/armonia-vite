import fs from 'fs'
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('fs', {
  readSettings: function () {
    return JSON.parse(fs.readFileSync('./settings.json', 'utf-8'))
  }
})
