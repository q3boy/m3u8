const strip = require('strip-ansi')
const {cyan, yellow, green} = require('chalk').bold
const EventEmitter = require('events')

const clocks = ['⠇', '⠏', '⠋', '⠉', '⠙', '⠹', '⠸', '⠼', '⠴', '⠤', '⠦', '⠧']

const FINISHED = '⠿'
const blocks = ["", "▏","▎","▍","▌","▋","▊","▉","█"]

const pad = num => `${num<=9?'0'+num:num}`

class ProgressBar extends EventEmitter{
  constructor (max = 1, {length = null, title = '', remain=false, live='face', stream=process.stderr, throttle=200}={}) {
    super()
    // assign all properties
    Object.assign(this, {stream, title, remain, live, throttle, bar: this.getBar(), value: 0, idx: 0, last: 0, begin: new Date()})
    // set max value
    this.setMax(max)
    // set length
    this.setLength(length > 0 ? length : stream.columns)
    // listen resize if stream is tty
    if (stream && stream.isTTY) {
      this.resize = () => this.setLength(stream.columns)
      stream.on('resize', this.resize)
    }
  }
  setMax(max) {
    this.max = max
    return this
  }
  setLength (length) {
    // get min length
    const minLength = strip(this.title).length + 7
    if (length < minLength) {
      length = minLength
    }
    this.length = length
    return this
  }
  setTitle(title) {
    this.title = title
    return this
  }
  tick (value) {
    return this.refresh(this.value + value)
  }
  finish () {
    return this.refresh(this.max)
  }
  refresh (value) {
    const {stream, max, throttle} = this
    const ts = new Date().getTime()
    this.value = value
    this.bar   = this.getBar()
    if (ts - this.last > throttle) {
      this.last = ts
      if (stream && stream.isTTY) {
        this.emit('before-draw', this.bar)
        stream.cursorTo(0)
        stream.clearLine()
        stream.write(this.bar)
      } else if (!stream) {
        this.emit('update', this.bar)
      }
    }
    if (value >= max) {
      this.emit('finish')
    }
    return this
  }
  formatTime (ratio) {
    let ts = new Date().valueOf() - this.begin.valueOf()
    ts = Math.round((ts / ratio - ts) / 1000)
    let hour = Math.floor(ts / 3600)
    let minute = Math.floor((ts % 3600) / 60)
    let second = (ts % 60)
    return `${pad(hour)}:${pad(minute)}:${pad(second)}`
  }
  getBar () {
    const {value, title, remain} = this
    const max = Math.max(value, this.max)
    let {length} = this
    const mark = value === max ? FINISHED : clocks[this.idx++ % clocks.length]
    const suffix = ` ${green(mark)} ${remain ? cyan(this.formatTime(value/max))+' ' : ''}${yellow(title)}`
    length -= strip(suffix).length + 2
    const barValue = value / max * length
    const barFill = Math.floor(barValue)
    const barPad = Math.round((barValue - barFill) * 8)
    const bar = "█".repeat(barFill) + blocks[barPad]
    return `⸨${bar}${' '.repeat(length - bar.length)}⸩${suffix}`
  }
  close () {
    if (this.resize) {
      this.stream.removeListener('resize', this.resize)
    }
    this.stream = null

  }
}

module.exports = (...args) => new ProgressBar(...args)