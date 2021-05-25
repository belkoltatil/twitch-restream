require('dotenv').config()

const { createServer }= require('http')
const { rmdir, mkdir, readFile } = require('fs/promises')
const pupa = require('pupa')
const TwitchStream = require('get-twitch-stream')
const TwitchPubSub = require('twitch-realtime')
const transcoder = require('./transcoder')

const twitchStream = new TwitchStream({
  channel: process.env.CHANNEL
})
const twitchPubSub = new TwitchPubSub({
  defaultTopics: [
    `video-playback-by-id.${process.env.CHANNEL_ID}`
  ],
  reconnect: true
})

async function cleanVideo () {
  try {
    await rmdir(process.env.TRANSCODE_OUTPUT_DIR, { recursive: true })
    await mkdir(process.env.TRANSCODE_OUTPUT_DIR)
  } catch (err) {
    console.error(err)
  }
}

async function startTranscode () {
  if (!(await twitchStream.streamLive())) return

  cleanVideo()

  try {
    console.debug('starting transcode...')

    const transcode = await transcoder({
      bitrate: process.env.TRANSCODE_BITRATE,
      height: process.env.TRANSCODE_HEIGHT,
      chunks: process.env.TRANSCODE_CHUNKS,
      chunkLength: process.env.TRANSCODE_CHUNK_LENGTH,
      streamURL: await twitchStream.getStreamURL([ 'source' ]),
      output: `${process.env.TRANSCODE_OUTPUT_DIR}stream.m3u8`
    })
    transcode.on('close', code => {
      console.debug('ffmpeg exited with code:', code)
      if (code !== 0) process.exit(code)
    })
    transcode.on('error', err => {
      console.error('ffmpeg error', '\n', err)
      process.exit(1)
    })
  } catch (err) {
    console.error('transcode error', '\n', err)
  }
}

createServer(async (req, res) => {
  let requestFile = req.url

  if (req.url.endsWith('.m3u8') || req.url.endsWith('.ts')) requestFile = `/video${req.url}`
  if (req.url === '/') requestFile = '/index.html'

  requestFile = `/public${requestFile}`

  try {
    const content = await readFile(`.${requestFile}`)

    if (requestFile.endsWith('.html')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      })

      const streamLive = await twitchStream.streamLive()
      const streamMeta = await twitchStream.getStreamMeta()

      return res.end(Buffer.from(pupa(content.toString(), {
        channel: process.env.CHANNEL,
        title: streamLive ? streamMeta.title : '',
        game: streamLive ? streamMeta.game : '',
        status: streamLive ? 'live' : 'offline',
        host: req.headers.host
      }), 'utf-8'), 'utf-8')
    }
    if (requestFile.endsWith('.js')) res.writeHead(200, {
      'Content-Type': 'text/javascript'
    })
    if (requestFile.endsWith('.css')) res.writeHead(200, {
      'Content-Type': 'text/css'
    })
    if (requestFile.endsWith('.m3u8')) res.writeHead(200, {
      'Content-Type': 'application/x-mpegURL'
    })
    if (requestFile.endsWith('.ts')) res.writeHead(200, {
      'Content-Type': 'video/MP2T'
    })

    res.end(content, 'utf-8')
  } catch (err) {
    if (err.code == 'ENOENT') {
      res.writeHead(404)
      res.end()
    } else {
      res.writeHead(500)
      res.end()
    }
  }
}).listen(process.env.PORT)

twitchPubSub.once('connect', () => {
  console.debug('Connected to Twitch PubSub (video-playback-by-id)')
})
twitchPubSub.on('reconnect', () => {
  console.debug('Reconnected to Twitch PubSub (video-playback-by-id)')
})
twitchPubSub.on('close', () => {
  console.debug('Disconnected from Twitch PubSub (video-playback-by-id)')
})
twitchPubSub.on('raw', async data => {
  if (data.type !== 'MESSAGE') return

  const type = JSON.parse(data.data.message).type

  if (type === 'stream-up' || type === 'stream_up') startTranscode()
})

startTranscode()

console.info(`Server running at http://127.0.0.1:${process.env.PORT}/`)

