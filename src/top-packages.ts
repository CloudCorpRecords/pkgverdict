/**
 * Well-known npm packages typosquats imitate. Bundled so checks work offline;
 * refresh by hand from npm download stats when a release goes out.
 */
export const TOP_PACKAGES: string[] = [
  // Runtimes, frameworks, meta-frameworks
  "react", "react-dom", "next", "vue", "nuxt", "svelte", "astro", "solid-js",
  "angular", "@angular/core", "express", "fastify", "koa", "hapi", "nest",
  // Build, bundlers, compilers
  "vite", "webpack", "rollup", "esbuild", "parcel", "turbopack", "swc",
  "typescript", "tsx", "ts-node", "jiti", "unbuild",
  // Testing
  "jest", "vitest", "mocha", "chai", "cypress", "playwright", "puppeteer",
  "supertest", "nock", "msw", "sinon", "ava", "tap",
  // Lint, format, quality
  "eslint", "prettier", "biome", "oxlint", "stylelint", "husky", "lint-staged",
  "eslint-plugin-unused-imports",
  // CLIs and prompts
  "commander", "yargs", "meow", "minimist", "inquirer", "prompts", "enquirer",
  "ora", "chalk", "picocolors", "kleur", "boxen", "cli-table3", "table",
  "update-notifier", "execa", "cross-spawn", "shelljs",
  // Dates, ids, utils
  "lodash", "lodash-es", "underscore", "ramda", "dayjs", "date-fns", "moment",
  "luxon", "uuid", "nanoid", "ulid", "semver", "glob", "rimraf", "fs-extra",
  "pathe", "mlly", "pkg-types", "std-env", "defu",
  // HTTP and data fetching
  "axios", "node-fetch", "got", "undici", "superagent", "ofetch", "ky", "wretch",
  "ws", "socket.io", "socket.io-client", "mqtt",
  // Validation, schemas, env
  "zod", "yup", "joi", "ajv", "validator", "dotenv", "dotenv-expand", "convict",
  // Databases, ORMs, queues
  "mongoose", "prisma", "@prisma/client", "typeorm", "drizzle-orm", "knex",
  "sequelize", "redis", "ioredis", "pg", "mysql2", "sqlite3", "better-sqlite3",
  "mongodb", "bullmq", "bee-queue",
  // Auth, security
  "jsonwebtoken", "bcrypt", "bcryptjs", "argon2", "passport", "helmet", "cors",
  // AI and LLM
  "openai", "anthropic", "langchain", "@langchain/core", "ollama", "together-ai",
  "@modelcontextprotocol/sdk", "ai", "vercel",
  // Rendering, markdown, docs
  "marked", "markdown-it", "remark", "rehype", "unified", "gray-matter",
  "highlight.js", "prismjs", "shiki",
  // Files, CSV, Excel, PDF, images
  "sharp", "jimp", "pdf-lib", "pdfkit", "exceljs", "xlsx", "csv-parse", "papaparse",
  "archiver", "unzipper", "tar", "adm-zip",
  // Browser, DOM, scraping
  "jsdom", "cheerio", "happy-dom",
  // State, data, forms (frontend)
  "redux", "@reduxjs/toolkit", "zustand", "jotai", "recoil", "mobx",
  "react-router", "react-router-dom", "@tanstack/react-query", "swr", "axios-retry",
  "react-hook-form", "formik",
  // Styling
  "tailwindcss", "styled-components", "@emotion/react", "sass", "less",
  "postcss", "autoprefixer", "clsx", "classnames", "tailwind-merge",
  // Payments, mail, misc services
  "stripe", "nodemailer", "twilio", "sendgrid",
  // Realtime, misc infra
  "chokidar", "nodemon", "concurrently", "npm-run-all", "pm2", "cron", "node-cron",
];
