const progress     = require('./progress')
const fs           = require('fs')
const EventEmitter = require('events')
const ffmpeg       = require('ffmpeg-static').path
const {spawn}      = require('child_process')
const {basename}   = require('path')

const {cursorTo, clearLine} = require('readline')
const {blue, cyan, yellow, green, red} = require('chalk').bold

const getms = (str) => {
  const [hour, minute, second, ms] = str.split(/[:\.]/)
  return hour * 360000 + minute * 6000 + second * 100 + ms * 1
}


const chars = ['⠇', '⠏', '⠋', '⠉', '⠙', '⠹', '⠸', '⠼', '⠴', '⠤', '⠦', '⠧']

class FFmpegError extends Error {
  constructor(code, cmd, stderr) {
    super('FFmpeg Transcode Error')
    stderr = stderr.trim()
      .replace(/^.+([\r\n]+ {2}.+)+/g, '')
      .trim()
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
      pbar: null, chunks: [], begin: new Date(),
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
  getSpeed () {
    let size
    try {
      fs.accessSync(this.name, fs.constants.R_OK)
      size = fs.statSync(this.name).size
    } catch (e) {
      size = 0
    }
    const second = (new Date().valueOf() - this.begin.valueOf()) / 1000
    let speed = Math.round(size / second)
    if (speed < 800) {
      speed = `${speed}B/s`
    } else if (speed < 800000) {
      speed = Math.round(speed / 100)
      speed = `${Math.floor(speed/10)}${speed%10===0?'':`.${speed%10}`}KB/s`
    } else {
      speed = Math.round(speed / 100000)
      speed = `${Math.floor(speed/10)}${speed%10===0?'':`.${speed%10}`}MB/s`
    }
    return speed.length < 9 ? ' '.repeat(9-speed.length)+speed : speed
  }
  spawn () {
    const {proxy} = this
    const cmd     = 'ffmpeg'
    const args    = ['-y', '-i', this.url, '-c', 'copy', this.name]
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
    const {std, url, fix} = this
    let flag = 0
    const getLine = () => `${fix} ${blue.underline(url)} ${green(chars[flag++ % chars.length])}`.trim()
    std.write(getLine())
    this.pbar = progress(100, {remain: true})
    this.roll = setInterval(()=>{
      clearLine(std)
      cursorTo(std, 0)
      std.write(getLine())
    }, 100)
    return this
  }
  analysis () {
    const {cp, pbar, std, name, url, fix} = this
    const regDur  = /\sDuration: (\d\d:\d\d:\d\d\.\d+),/
    const regTime = /\stime=(\d\d:\d\d:\d\d\.\d+)\s/

    cp.stderr.on('data', data => {
      data = data.toString()
      pbar.setTitle(`${red(this.getSpeed())} ${name} ${fix}`.trimRight())
      if (regDur.test(data)) {
        clearInterval(this.roll)
        pbar.setMax(getms(data.match(regDur)[1]))
      } else if (regTime.test(data)) {
        pbar.refresh(getms(data.match(regTime)[1]))
      }
    })
    cp.on('close', code => {
      pbar.close()
      clearLine(std, 0)
      cursorTo(std, 0)
      if (code !== 0) {
        this.emit('error', new FFmpegError(code, this.cmd, Buffer.concat(this.chunks).toString()))
      } else {
        console.log(`${fix} ${yellow.underline(name)} done, elapsed ${cyan(this.getElpased())}, speed ${red(this.getSpeed().trim())}.`.trim())
        this.emit('done', url, name)
      }
    })
  }
}

const download = (...args) => new Promise((resolve, reject) => {
  new Download(...args)
    .on('done', (...args) => resolve(...args))
    .on('error', err => reject(err))
})

module.exports = download



// const str = `
// ffmpeg version 3.2.4 Copyright (c) 2000-2017 the FFmpeg developers
//   built with Apple LLVM version 8.0.0 (clang-800.0.42.1)
//   configuration: --prefix=/usr/local/Cellar/ffmpeg/3.2.4 --enable-shared --enable-pthreads --enable-gpl --enable-version3 --enable-hardcoded-tables --enable-avresample --cc=clang --host-cflags= --host-ldflags= --enable-libmp3lame --enable-libx264 --enable-libxvid --enable-opencl --disable-lzma --enable-vda
//   libavutil      55. 34.101 / 55. 34.101
//   libavcodec     57. 64.101 / 57. 64.101
//   libavformat    57. 56.101 / 57. 56.101
//   libavdevice    57.  1.100 / 57.  1.100
//   libavfilter     6. 65.100 /  6. 65.100
//   libavresample   3.  1.  0 /  3.  1.  0
//   libswscale      4.  2.100 /  4.  2.100
//   libswresample   2.  3.100 /  2.  3.100
//   libpostproc    54.  1.100 / 54.  1.100
// [tcp @ 0x7feaf0c0ef20] Connection to tcp://localhost:1087 failed (Connection refused), trying next address
// [http @ 0x7feaf0c0eb20] HTTP error 500 Internal Privoxy Error
// http://vvip.201606a7.pw:86/wuma/cm-061815-902/cm-061815-902.m3u8: Server returned 5XX Server Error reply
// `
