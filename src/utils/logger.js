var colors = require('colors');
const { DateTime } = require('luxon');
const getCallerFile = require('get-caller-file');

// TODO: Add file stuff
class Logger {
  localColors = {
    info: 'brightGreen',
    warn: 'yellow',
    error: 'red',
    verbose: 'brightCyan',
    debug: 'brightMagenta',
  };

  constructor(opts) {
    this.opts = opts ? opts : {};
  }

  #log(msg, level, caller) {
    const opts = this.opts;

    const localColor = this.localColors[level];

    let textColor = 'white';
    let extras = '';
    if (opts) {
      if (opts.disableLogs) return;

      if (opts.disableSpecific) {
        if (
          opts.disableSpecific.enabled &&
          opts.disableSpecific.toDisable.includes(level)
        )
          return;
      }

      if (opts.timestamp) {
        const dt = DateTime.now();
        extras += `[${dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS, 'SE')}]`
          .blue;
      }

      if (opts.extraStatic) {
        const color = opts.extraStatic.color ? opts.extraStatic.color : 'white';
        extras += `[${opts.extraStatic.text}]`[color];
      }

      if (opts.file) {
        const path = caller;
        const splitPath = path.split('/');
        const file = splitPath[splitPath.length - 1];

        extras += `[${file}]`.gray;
      }

      if (opts.text) {
        if (opts.text.color) textColor = opts.text.color;
      }
    }
    let parsedMsg =
      `[${level.toUpperCase()}]`[localColor] +
      `${extras}` +
      ': ' +
      `${msg}\n`[textColor];

    process.stdout.write(parsedMsg);
  }

  info(msg) {
    this.#log(msg, 'info', getCallerFile());
  }

  warn(msg) {
    this.#log(msg, 'warn', getCallerFile());
  }

  error(msg) {
    this.#log(msg, 'error', getCallerFile());
  }

  verbose(msg) {
    this.#log(msg, 'verbose', getCallerFile());
  }

  debug(msg) {
    this.#log(msg, 'debug', getCallerFile());
  }
}

const logger = new Logger({
  timestamp: true,
  // extraStatic: { text: 'Worker 1', color: 'green' },
  file: true,
  text: {
    color: 'white',
  },
  disableLogs: false,
  disableSpecific: {
    enabled: false, // process.env.LOCAL_DEV === 'false',
    toDisable: ['debug'],
  },
});

module.exports = { logger, Logger };
