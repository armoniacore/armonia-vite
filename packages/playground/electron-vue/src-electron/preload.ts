import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  readSettings: function () {
    return {
      settings: {
        motd: 'This is the message of the day from electron!'
      }
    }
  }
})
