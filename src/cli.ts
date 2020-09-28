#!/usr/bin/env node
import { join } from "path"
import { ANSIColor, color } from "tutils/ansi"
import { CommandLineOption, formatCommandLineOptions, parseCommandLineArguments } from "tutils/commandLine"
import { HTTPRequest, HTTPResponse } from "tutils/httpServer"
import { Matcher } from "tutils/matcher"
import { WebServer } from "./webServer"

const commandOptions: { [option: string]: CommandLineOption } = {
	// Host
	"--host": {
		group: "Host",
		argument: "host",
		description: "Serve Address to use [0.0.0.0]:[auto]"
	},
	"--port": {
		alias: ["-p"],
		argument: "port",
		description: "Port to use [auto]"
	},
	"--address": {
		alias: ["-a"],
		argument: "address",
		description: "Address to use [0.0.0.0]"
	},

	// Browser
	"--open": {
		group: "Browser",
		alias: ["-o"],
		argument: "path",
		default: true,
		description: `Open browser window after starting the server\nOptionally provide a URL path to open the browser window to`
	},
	"--open-url": {
		argument: "path",
		default: "",
		description: `provide a URL path to open the browser window to`
	},
	"--open-client": {
		argument: "app",
		default: "",
		description: `default browser`
	},
	"--no-dir": {
		description: "Do not show directory list"
	},

	// Logger
	"--utc": {
		group: "Logger",
		alias: ["-U"],
		description: "Use UTC time format in log messages"
	},
	"--log": {
		alias: ["-s"],
		description: "Print log messages"
	},
	"--log-ip": {
		description: "Enable logging of the client\"s IP address"
	},

	// Server
	"--cwd": {
		group: "server",
		argument: "path",
		description: "cwd"
	},
	"--proxy": {
		alias: ["-P"],
		argument: "url",
		description: "Fallback proxy if the request cannot be resolved. e.g.: http://github.com"
	},

	"--root-path": {
		argument: "path",
		description: ""
	},
	"--index": {
		alias: ["-I"],
		multiple: true,
		argument: "fileName",
		description: "main file"
	},
	"--ssl": {
		description: "Enable https"
	},
	"--cert": {
		argument: "filePath",
		default: "",
		description: "Path to ssl cert file (default: cert.pem)."
	},
	"--key": {
		argument: "filePath",
		default: "",
		description: "Path to ssl key file (default: key.pem)"
	},
	"--http2": {
		description: "Enable http2"
	},
	"--max-length": {
		argument: "maxAllowedContentLength",
		description: "max allowed content length (default: 20 * 1024 * 1024)"
	},
	"--version": {
		alias: ["-v"],
		description: "Print version"
	},
	"--help": {
		alias: ["-h", "-?"],
		description: "Print help"
	}
}
const argv = parseCommandLineArguments(commandOptions)
if (argv["--help"]) {
	console.info([
		"Usage: h2server [port or url] [options]",
		"",
		"Options:",
		formatCommandLineOptions(commandOptions)
	].join("\n"))
	process.exit()
}

const port = argv["--port"] || ""
const address = argv["--address"] || ""
const rootServe = argv["--root-path"] || "/"
const rootDir = argv["--cwd"] as string || process.cwd()
const openURL = argv["--open-url"] as string
const open = argv["--open"] as string | boolean
const url = typeof open === "string" ? open : argv[0] as string || argv["--host"] as string || `${address}${port ? `:${port}` : ""}${rootServe}`

const logger = {
	log: argv["--log"] ? console.info : () => { },
	request: (request: HTTPRequest, response: HTTPResponse, server: WebServer) => {
		const date = argv["--utc"] ? new Date().toUTCString() : new Date()
		const ip = argv["--log-ip"] ? request.headers["x-forwarded-for"] || "" + request.connection.remoteAddress : ""
		logger.log(
			"[%s] %s %s %s %s",
			date, ip, color(request.method, ANSIColor.cyan), color(request.url, ANSIColor.cyan),
			request.headers["user-agent"]
		)
	}
}
const staticPath = argv["--static"] as string | undefined
const redirect = argv["--redirect"] as string | undefined
const proxy = argv["--proxy"] as string | undefined

const server = new WebServer({
	url,
	https: /^https:/i.test(url) || !!argv["--https"],
	http2: !!argv["--http2"] || !!(url && /^https:/i.test(url)),
	cert: argv["--cert"] as string,
	key: argv["--key"] as string,
	open: argv["--open-client"] as string || !!open || openURL,
	openURL,
	rootDir,
	routers: [
		{
			match: "**",
			proxy: proxy,
			static: staticPath,
			rewrite: redirect,
			break: !!redirect || !!proxy || false,
			async process(req, res, server) {
				const { path } = req
				const { fs } = server
				const filePath = server.mapPath(path)
				const fileStaticPath = server.mapPath(join(staticPath || "", path))
				const matcher = new Matcher("**" || (() => true), undefined, true)
				if (staticPath && filePath) {
					if (typeof staticPath === "string") {
						try {
							const stat = await fs.getStat(filePath)
							if (stat.isDirectory() && fileStaticPath) {
								const entries = await fs.readDir(filePath)
								const entriesStatic = await fs.existsDir(fileStaticPath) ? await fs.readDir(fileStaticPath) : []
								for (const index of server.defaultPages) {
									if (!entries.includes(index) && entriesStatic.includes(index)) {
										const indexPath = join(fileStaticPath, index)
										if (await fs.existsFile(indexPath)) {
											req.path = join(staticPath, path, index)
										}
									}
								}
							}
						}
						catch (e) {
							if (fileStaticPath) {
								const stat = await fs.getStat(fileStaticPath)
								if (stat.isFile()) {
									req.path = join(staticPath, path)
								}
							}
						}
					}
				}
				logger.request(req, res, server)
			}
		},
		{
			match: "*.ejs",
			async process(req, res, server) {
				await server.writeEJS(req, res, server.mapPath(req.path)!)
			}
		},
		{
			match: "*.njs",
			async process(req, res, server) {
				await server.writeServerJS(req, res, server.mapPath(req.path)!)
			}
		}
	],
	defaultPages: argv["--index"] as string[],
	directoryList: !argv["--no-dir"],
	maxAllowedContentLength: typeof argv["--max-length"] === "string" ? parseInt(argv["--max-length"], 10) : undefined
})

server.start().then(() => {
	console.info(color(`Server Running At ${server.url}`, ANSIColor.green))
	console.info("Hit CTRL-C to stop the server")
})