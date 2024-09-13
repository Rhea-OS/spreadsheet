import * as fs from 'node:fs/promises';
import * as fss from 'node:fs';
import * as cp from 'node:child_process';
import esbuild from 'esbuild';

import { config } from './build.js';
import log from './log.js';
import { has_changed } from './util.js';

const is_source = path => path.startsWith(config.get().root.join("src"));

export async function build_plugin() {
    if (!await has_changed({
        glob: path => is_source(path),
        dependents: [config.get().out.join("main.js")]
    }))
        return log.verbose("Skipping Rebuild");

    await esbuild.build({
        entryPoints: ["src/main.ts"],
        bundle: true,
        sourcemap: true,
        platform: 'node',
        format: 'cjs',
        external: ['electron', 'obsidian'],
        outdir: config.get().out.path
    });
}

export async function build_package_json() {
    if (!await has_changed({
        glob: path => is_source(path),
        dependents: [config.get().out.join("package.json")]
    }))
        return log.verbose("Skipping Rebuild");

    const jq = cp.spawn('jq', ['-r', '. *  .deploy * {deploy:null} | with_entries(select(.value |. != null))']);

    fss.createReadStream(config.get().root.join("package.json").path)
        .pipe(jq.stdin);

    jq.stdout.pipe(fss.createWriteStream(config.get().out.join("package.json").path), 'utf8');

    await new Promise((ok, err) => jq.on("exit", code => code == 0 ? ok() : err(code)));
}

export async function build_manifest_json() {
    if (!await has_changed({
        glob: path => is_source(path),
        dependents: [config.get().out.join("manifest.json")]
    }))
        return log.verbose("Skipping Rebuild");

    const jq = cp.spawn('jq', ['-r', '.']);

    fss.createReadStream(config.get().root.join("manifest.json").path)
        .pipe(jq.stdin);

    jq.stdout.pipe(fss.createWriteStream(config.get().out.join("manifest.json").path), 'utf8');

    await new Promise((ok, err) => jq.on("exit", code => code == 0 ? ok() : err(code)));
}

export async function build_style_css() {
    if (!await has_changed({
        glob: path => is_source(path),
        dependents: [config.get().out.join("styles.css")]
    }))
        return log.verbose("Skipping Rebuild");

    await esbuild.build({
        entryPoints: ["styles.css"],
        bundle: true,
        sourcemap: true,
        outdir: config.get().out.path
    });
}

export async function phony_install() {
    const pkg = await fs.readFile(config.get().root.join("package.json"))
        .then(pkg => JSON.parse(pkg).name);
    
    const install = config.get().vault.join(".obsidian/plugins").join(pkg).path;

    await fs.mkdir(install, { recursive: true });

    for await (const file of config.get().out.readdir())
        await fs.copyFile(file.path, install);
}
