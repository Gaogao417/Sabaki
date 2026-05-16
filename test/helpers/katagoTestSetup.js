global.window = {
  sabaki: {
    setting: {
      get: (key) => (key === 'gtp.engine_quit_timeout' ? 3000 : null),
    },
  },
}
