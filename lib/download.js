const progress     = require('./progress')
const {spawn}      = require('child_process')
const {basename}   = require('path')
const EventEmitter = require('events')
const ffmpeg       = require('ffmpeg-static').path
const {blue, cyan, yellow, green} = require('chalk').bold
const {moveCursor, cursorTo, clearLine} = require('readline')

const getms = (str) => {
  const [hour, minute, second, ms] = str.split(/[:\.]/)
  return hour * 360000 + minute * 6000 + second * 100 + ms * 1
}

const chars = ['⠇', '⠏', '⠋', '⠉', '⠙', '⠹', '⠸', '⠼', '⠴', '⠤', '⠦', '⠧']

class FFmpegError extends Error {
  constructor(code, cmd, stderr) {
    super('FFmpeg Transcode Error')
    Object.assign(this, {code, stderr, cmd})
  }
  toString() {
    return [
      this.message, "======================",
      `cmd: ${this.cmd}`, "--------------------------------------------",
      this.stderr
    ].join("\n")
  }
}

class Download extends EventEmitter{
  constructor(url, fix='', {std=process.stderr, proxy='localhost:1087'} = {}) {
    super()
    Object.assign(this, {
      url, fix, std, proxy,
      flag : 1, pbar: null, chunks: [], begin: new Date(),
      name:`${basename(url, '.m3u8')}.ts`,
    })
    this.spawn().killcp().prepare().analysis()
  }
  getElpased () {
    let ts = Math.round((new Date().valueOf() - this.begin.valueOf()) / 1000)
    if (ts === 0 || ts === Infinity) {
      return '--:--:--'
    }
    let hour = Math.floor(ts / 3600)
    let minute = Math.floor((ts % 3600) / 60)
    let second = (ts % 60)
    return `${hour<=9?'0'+hour:hour}:${minute<=9?'0'+minute:minute}:${second<=9?'0'+second:second}`
  }
  spawn () {
    const {proxy} = this
    const cmd     = 'caffeinate'
    const args    = ['-i', ffmpeg, '-y', '-i', this.url, '-c', 'copy', this.name]
    const env     = !proxy ? process.env : Object.assign({}, process.env, {
      http_proxy:`http://${proxy}`,
      https_proxy:`https://${proxy}`
    })
    this.cmd = `${cmd} ${args.join(' ')}`
    this.cp = spawn(cmd, args, {env, cwd: process.cwd()})
    this.cp.on('error', err => this.emit('error', err))
    this.cp.stderr.on('data', d => this.chunks.push(d))
    return this
  }
  killcp () {
    const {cp} = this
    this.onExit = () => cp.kill()
    process.on('exit', this.onExit)
    cp.on('close', () => process.removeListener('exit', this.onExit))
    return this
  }
  prepare () {
    // const loadingLength = cyan('-').length
    const {std, name, url, fix} = this
    std.write(`${fix} ${blue.underline(url)} ${green('-')}`.trim())
    this.pbar = progress(100, {remain: true, title: `${name} ${fix}`.trim()})
    this.roll = setInterval(()=>moveCursor(std, -1) || std.write(green(chars[++this.flag % chars.length])), 100)
    return this
  }
  analysis () {
    const {cp, pbar, std, name, url, fix} = this
    const regDur  = /\sDuration: (\d\d:\d\d:\d\d\.\d+),/
    const regTime = /\stime=(\d\d:\d\d:\d\d\.\d+)\s/

    cp.stderr.on('data', d => {
      d = d.toString()
      if (regDur.test(d)) {
        clearInterval(this.roll)
        pbar.setMax(getms(d.match(regDur)[1]))
          // .refresh(0)
      } else if (regTime.test(d)) {
        pbar.refresh(getms(d.match(regTime)[1]))
      }
    })
    cp.on('close', code => {
      clearLine(std, 0)
      cursorTo(std, 0)
      if (code !== 0) {
        this.emit('error', new FFmpegError(code, this.cmd, Buffer.concat(this.chunks).toString()))
      } else {
        console.log(`${fix} ${yellow.underline(name)} done, elapsed ${cyan(this.getElpased())}`.trim())
        this.emit('done', url, name)
      }
    })
  }
}

module.exports = (...args) => new Promise((resolve, reject) => {
  new Download(...args)
    .on('done', (...args) => resolve(...args))
    .on('error', err => reject(err))
})