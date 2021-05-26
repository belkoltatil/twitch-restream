const { spawn } = require('child_process')

async function transcodeStream (options = {
  bitrate: 600,
  height: 360,
  fps: 30,
  chunks: 5,
  chunkLength: 2,
  streamURL: 'live.m3u8',
  output: 'public/video/stream.m3u8'
}) {
  return new Promise(async (resolve, reject) => {
    const ffmpeg_args = [
      '-hide_banner',
      '-loglevel', 'quiet',
      '-y',
      '-fflags', 'nobuffer',
      '-i', `${options.streamURL}`,
      '-c:v', 'libx264',
      '-x264opts', `keyint=${options.fps * 2}:no-scenecut`,
      '-vf', `scale=-1:${options.height}:flags=bilinear`,
      '-r', `${options.fps}`,
      '-b:v', `${options.bitrate}k`,
      '-profile:v', 'main',
      '-c:a', 'copy',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-fflags', 'flush_packets',
      '-flags', 'low_delay',
      '-flags2', 'fast',
      '-f', 'hls',
      '-hls_init_time', `${Math.floor(options.chunkLength / 2)}`,
      '-hls_time', `${options.chunkLength}`,
      '-hls_list_size', `${options.chunks}`,
      '-hls_delete_threshold', `${Math.floor(options.chunks / 2)}`,
      '-hls_flags', 'delete_segments',
      `${options.output}`
    ]
    const ffmpeg = spawn('ffmpeg', ffmpeg_args, {
      cwd: process.cwd()
    })

    function abort (signal) {
      try {
        ffmpeg.stdin.setEncoding('utf-8')
        ffmpeg.stdin.write('q\n')
      } catch (error) {}
      if (signal === 'SIGINT' || signal === 'SIGHUP') {
        setTimeout(() => {
          process.exit(0)
        }, 2000)
      } else {
        setTimeout(() => {
          process.exit(1)
        }, 2000)
      }
    }

    process.on('SIGINT', abort)
    process.on('SIGHUP', abort)
    process.on('uncaughtException', abort)

    ffmpeg.on('close', code => {
      process.removeListener('SIGINT', abort)
      process.removeListener('SIGHUP', abort)
      process.removeListener('uncaughtException', abort)
    })

    if (ffmpeg.pid) return resolve(ffmpeg)
    return reject()
  })
}

module.exports = transcodeStream
