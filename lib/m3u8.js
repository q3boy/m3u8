const playlist = require('../lib/playlist')
const download = require('../lib/download')
const fs = require('fs')
const commander = require('commander')
const cliCursor = require('cli-cursor')

cliCursor.hide()

const args = commander.version(require('../package.json').version)
  .description('Download a m3u8 url, or all url in list-file.')
  .option('-P, --no-proxy', 'Disable http proxy')
  .option('-t, --type <type>', 'Output file type, default is "ts".', 'ts')
  .arguments('[url|list-file]')
  .parse(process.argv)

const {proxy, type, args: [param]} = args

const downloadOpt = proxy ? {type} : {proxy, type}

if (!param) {
  args.help()
} else {
  fs.access(param, fs.constants.R_OK, err => {
    if (!err) {
      playlist(param)
        .run((url, fix) => download(url, fix, downloadOpt))
          .then(() => console.log('All done.'))
    } else if (/http:\/\/.+/.test(param)) {
      download(param, '', downloadOpt)
        .catch(err => console.error(err.toString()))
    } else {
      args.help()
    }
  })
}