import * as fs from 'node:fs/promises';
import State from '@j-cake/jcake-utils/state';
import { iterSync } from '@j-cake/jcake-utils/iter';
import * as Format from '@j-cake/jcake-utils/args';
import chalk from 'chalk';

import log from './log.js';
import Path from './path.js';
import * as comp from './components.js';

export const config = new State({
    logLevel: 'info',
    force: false,

    root: new Path(process.cwd()),
    out: new Path(process.cwd()).concat('build'),

    components: []
});

export default async function main(argv) {
    const logLevel = Format.oneOf(Object.keys(log), false);

    for (const { current: i, skip: next } of iterSync.peekable(argv))
        if (i == '--log-level')
            config.setState({ logLevel: logLevel(next()) });

        else if (i == '-f' || i == '--force')
            config.setState({ force: true });

        else if (i == '-o' || i == '--out')
            config.setState({ out: new Path(next()) });

        else
            config.setState(prev => ({ components: [...prev.components, i] }));

    log.debug(config.get());

    await fs.mkdir(config.get().out.path, { recursive: true });

    for (const component of config.get().components)
        if (component in components)
            await components[component]()
                .then(status => log.info(`${chalk.grey(component)}: Done`));
}

export const components = {
    "build:plugin": () => comp.build_plugin(),
    "build:package.json": () => comp.build_package_json(),
    "build:manifest.json": () => comp.build_manifest_json(),
    "build:style.css": () => comp.build_style_css(),

    "phony:install": () => comp.phony_install(),
    "phony:all": () => Promise.all(Object.entries(components)
        .filter(([comp, _]) => comp.startsWith("build:"))
        .map(([_, fn]) => fn())),
}
