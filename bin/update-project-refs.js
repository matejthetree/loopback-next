#!/usr/bin/env node
// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: loopback-next
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * This is an internal script to update TypeScript project references based on
 * lerna's local package dependencies.
 *
 * See https://www.typescriptlang.org/docs/handbook/project-references.html
 */
'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');
const debug = require('debug')('loopback:build');
const buildUtils = require('../packages/build/bin/utils');

const Project = require('@lerna/project');
const PackageGraph = require('@lerna/package-graph');

const TSCONFIG = 'tsconfig.build.json';

async function updateReferences(options) {
  options = options || {};
  const dryRun = options.dryRun;
  const project = new Project(process.cwd());
  const packages = await project.getPackages();

  const rootRefs = [];
  const graph = new PackageGraph(packages);

  for (const p of graph.values()) {
    debug('Package %s', p.pkg.name);
    const pkgLocation = p.pkg.location;
    const tsconfigFile = path.join(pkgLocation, TSCONFIG);
    // Skip non-typescript packages
    if (!fs.existsSync(tsconfigFile)) {
      debug('Skipping non-TS package: %s', p.pkg.name);
      continue;
    }
    rootRefs.push({
      path: path.join(path.relative(project.rootPath, pkgLocation), TSCONFIG),
    });
    const tsconfig = require(tsconfigFile);
    const refs = [];
    for (const d of p.localDependencies.keys()) {
      const depPkg = graph.get(d);
      // Skip non-typescript packages
      if (!fs.existsSync(path.join(depPkg.pkg.location, TSCONFIG))) {
        debug('Skipping non-TS dependency: %s', depPkg.pkg.name);
        continue;
      }
      const relativePath = path.relative(pkgLocation, depPkg.pkg.location);
      refs.push({path: path.join(relativePath, TSCONFIG)});
    }
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    // composite must be true for project refs
    tsconfig.compilerOptions.composite = true;
    // outDir & target have to be set in tsconfig instead of CLI for tsc -b
    tsconfig.compilerOptions.target =
      tsconfig.compilerOptions.target || buildUtils.getCompilationTarget();
    tsconfig.compilerOptions.outDir =
      tsconfig.compilerOptions.outDir ||
      buildUtils.getDistribution(tsconfig.compilerOptions.target);
    tsconfig.references = refs;

    // Convert to JSON
    const tsconfigJson = JSON.stringify(tsconfig, null, 2);

    if (!dryRun) {
      // Using `-f` to overwrite tsconfig.build.json
      fs.writeFileSync(tsconfigFile, tsconfigJson + '\n', {encoding: 'utf-8'});
      debug('%s has been updated.', tsconfigFile);
    } else {
      // Otherwise write to console
      debug(tsconfigJson);
      console.log('%s', p.pkg.name);
      refs.forEach(r => console.log('  %s', r.path));
    }
  }

  const rootTsconfigFile = path.join(project.rootPath, 'tsconfig.json');
  const rootTsconfig = require(rootTsconfigFile);
  rootTsconfig.compilerOptions = rootTsconfig.compilerOptions || {};
  rootTsconfig.compilerOptions.composite = true;
  rootTsconfig.references = rootRefs;
  // Convert to JSON
  const rootTsconfigJson = JSON.stringify(rootTsconfig, null, 2);
  if (!dryRun) {
    // Using `-f` to overwrite tsconfig.json
    fs.writeFileSync(rootTsconfigFile, rootTsconfigJson + '\n', {
      encoding: 'utf-8',
    });
    debug('%s has been updated.', rootTsconfigFile);
  } else {
    debug(rootTsconfigJson);
    console.log('\n%s', path.relative(project.rootPath, rootTsconfigFile));
    rootRefs.forEach(r => console.log('  %s', r.path));
    console.log(
      '\nThis is a dry-run. Please use -f option to update tsconfig files.',
    );
  }
}

if (require.main === module) {
  const dryRun = process.argv[2] !== '-f';
  updateReferences({dryRun});
}
