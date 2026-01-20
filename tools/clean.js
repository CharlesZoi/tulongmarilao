const fs = require('fs');
const path = require('path');
const { minify: minifyJS } = require('terser');
const CleanCSS = require('clean-css');
const { minify: minifyHTML } = require('html-minifier-terser');

const root = path.resolve(__dirname, '..');
const outRoot = path.join(root, 'cleaned');
const excludeDirs = new Set(['node_modules', '.git', 'cleaned', 'tools']);
let count = 0;

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function processDir(absDir, relDir = '') {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      await processDir(path.join(absDir, entry.name), path.join(relDir, entry.name));
    } else if (entry.isFile()) {
      await processFile(path.join(absDir, entry.name), path.join(relDir, entry.name));
    }
  }
}

async function processFile(absPath, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const dest = path.join(outRoot, relPath);
  ensureDirSync(path.dirname(dest));

  try {
    if (ext === '.js') {
      const src = fs.readFileSync(absPath, 'utf8');
      const result = await minifyJS(src, {
        compress: {
          drop_console: false,
          pure_funcs: [
            'console.log',
            'console.info',
            'console.debug',
            'console.trace'
          ]
        },
        mangle: false,
        format: { comments: false },
        safari10: true,
      });
      fs.writeFileSync(dest, result.code || '', 'utf8');
      count++;
      return;
    }

    if (ext === '.css') {
      const src = fs.readFileSync(absPath, 'utf8');
      const result = new CleanCSS({ level: 2 }).minify(src);
      fs.writeFileSync(dest, result.styles || '', 'utf8');
      count++;
      return;
    }

    if (ext === '.html' || ext === '.htm') {
      const src = fs.readFileSync(absPath, 'utf8');
      const result = await minifyHTML(src, {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeEmptyAttributes: true,
        removeOptionalTags: false,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: {
          compress: {
            drop_console: false,
            pure_funcs: [
              'console.log',
              'console.info',
              'console.debug',
              'console.trace'
            ]
          },
          mangle: false,
          format: { comments: false }
        },
        html5: true,
        keepClosingSlash: true,
      });
      fs.writeFileSync(dest, result || '', 'utf8');
      count++;
      return;
    }

    if (ext === '.json') {
      const src = fs.readFileSync(absPath, 'utf8');
      try {
        const obj = JSON.parse(src);
        fs.writeFileSync(dest, JSON.stringify(obj), 'utf8');
      } catch (_) {
        fs.writeFileSync(dest, src, 'utf8');
      }
      count++;
      return;
    }

    fs.copyFileSync(absPath, dest);
    count++;
  } catch (_) {
    try {
      fs.copyFileSync(absPath, dest);
      count++;
    } catch {}
  }
}

async function main() {
  if (fs.existsSync(outRoot)) {
    if (fs.rmSync) fs.rmSync(outRoot, { recursive: true, force: true });
    else removeDirFallback(outRoot);
  }
  ensureDirSync(outRoot);
  await processDir(root);
  console.log(`Clean complete: ${count} files -> ${path.relative(root, outRoot)}`);
}

function removeDirFallback(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    const p = path.join(dirPath, entry);
    const stat = fs.lstatSync(p);
    if (stat.isDirectory()) removeDirFallback(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dirPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
