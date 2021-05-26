document.addEventListener('DOMContentLoaded', () => {
  const video = document.querySelector('video')
  const videoSrc = './stream.m3u8'

  const volumeSlider = document.querySelector('input[type=range]')
  volumeSlider.addEventListener('input', e => {
    if (video.muted) {
      video.muted = false
    }
    video.volume = volumeSlider.value
  })

  if (/Mobi/i.test(window.navigator.userAgent)) video.controls = true
  video.volume = volumeSlider.value > 0 ? volumeSlider.value : 0.5
  video.muted = true
  volumeSlider.value = 0

  const videoControls = document.querySelector('#video-controls')
  videoControls.addEventListener('auxclick', e => {
    video.muted = !video.muted
    if (video.muted) {
      volumeSlider.value = 0
    } else {
      volumeSlider.value = video.volume
    }
  })

  const reattach = () => {
    if (Hls.isSupported()) {
      hls.detachMedia(video)
      hls.attachMedia(video)
    } else {
      video.src = null
      video.src = videoSrc
      video.play()
    }
  }

  const playPauseButton = document.querySelector('#play_pause > button')
  playPauseButton.addEventListener('click', e => {
    if (video.paused) {
      playPauseButton.className = 'icon-pause'
      if ((video.duration - video.currentTime) > 16) {
        video.currentTime = video.duration - 1
      }
      video.play()
    } else {
      playPauseButton.className = 'icon-play'
      video.pause()
    }
  })

  const reloadButton = document.querySelector('#reload > button')
  reloadButton.addEventListener('dblclick', e => {
    reattach()
  })

  if (Hls.isSupported()) {
    window.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 0,
      liveSyncDurationCount: 2
    })
    hls.loadSource(videoSrc)
    hls.attachMedia(video)
    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      video.play()
    })
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // try to recover network error
            console.log('fatal network error encountered, try to recover')
            hls.startLoad()
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('fatal media error encountered, try to recover')
            hls.recoverMediaError()
            break
          default:
            // cannot recover
            hls.destroy()
            break
        }
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = videoSrc
    video.addEventListener('canplay', () => {
      video.play()
    })
  }
})
