# H2Server
An out-of-the-box web server for serving up local files, support https & http2.

![overview][overview]

## Installation
First, install [Node.js](http://nodejs.org/). Then:

```bash
npm install h2server -g
```

## Usage
Run `h2server` on the command line to fire up an HTTP/1.1 server on 0.0.0.0:
```bash
h2server
```

H2Server will serve out of your current working directory.

You can pass in arguments to change the port and host:
```bash
h2server 8080
```

In order to support HTTP/2, you should specify an https url:
```bash
h2server https://0.0.0.0:8080
```
By default, H2server will use an untrusted self-signed certificate. You should skip the certificate warning in browser. Pass `--cert` and `--key` to specify your certificate.

In additional, you can pass `-o`/`--open` to open homepage in browser when started:
```bash
h2server -o
```

## Options
- `--open`, `-o`: Open browser after starting the server
- `--help`, `-h`, `-?`: Print helps
- `--cors`: Enable CORS via the Access-Control-Allow-Origin header
- `--proxy`, `-p`: Proxies all requests which can't be resolved locally to the given url. e.g.: -p http://someurl.com
- `--cert`: Path to ssl cert file
- `--key `: Path to ssl key file
- `--version`, `-v`: Print version

[overview]: https://github.com/Teal/H2Server/blob/master/screenshot.png?raw=true