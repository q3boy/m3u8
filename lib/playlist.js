const {readFileSync, writeFileSync} = require('fs')
const {red} = require('chalk').bold

class Playlist {
  constructor(file) {
    this.file = file
    this.list = this.read()
  }

  read () {
    return readFileSync(this.file)
      .toString()
      .split('\n')
      .map(d => d.trim())
      .filter(d => d !== '')
  }

  remove(url) {
    writeFileSync(this.file, this.read().filter(d=>d !== url).join("\n"))
    return this
  }

  run(cb) {
    return new Promise((resolve) => {
      const {list} = this
      const total = list.length
      const run = () => {
        if (list.length === 0) {
          return resolve()
        }
        cb(list.shift(), red(`${total-list.length}/${total}`))
          .then(url => {
            this.remove(url)
            run()
          })
          .catch(err => {
            console.error(err.toString())
            run()
          })
      }
      run()
    })
  }
}

module.exports = (...args) => new Playlist(...args)