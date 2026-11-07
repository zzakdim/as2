#!/usr/bin/env python3
"""Bundle play.html + engine.js + levels.js into one self-contained page for a Claude Artifact.

Usage: python3 build_artifact.py OUT.html
"""
import pathlib
import re
import sys

here = pathlib.Path(__file__).parent
html = (here / 'play.html').read_text()
engine = (here / 'engine.js').read_text()
levels = (here / 'levels.js').read_text()

style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)


def sub(old, new):
    global style
    assert old in style, old
    style = style.replace(old, new)


# Artifact page contract: dark single-theme look, safe-area side gutters, rounded display font.
sub('--good: #8ee0a6; --warn: #ffcf7a;\n  }', '--good: #8ee0a6; --warn: #ffcf7a;\n    color-scheme: dark;\n  }')
sub('font: 15px/1.4 ui-rounded,', 'font: 15px/1.4 "Fredoka", ui-rounded,')
sub('padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom); }',
    'padding-block: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); '
    'padding-right: max(16px, env(safe-area-inset-right, 0px)); }')
sub('header h1 { font-size: 18px;', 'header h1 { font-size: 20px; font-weight: 600;')
style += ('  button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n'
          '  @media (prefers-reduced-motion: reduce) { .cup { transition: none; } }\n')

body = body.replace('<script src="engine.js"></script>', '<script>\n' + engine + '\n</script>')
body = body.replace('<script src="levels.js"></script>', '<script>\n' + levels + '\n</script>')

out = ('<title>Magic Boba</title>\n'
       '<meta name="claude:viewport-fit-sides" content="cover">\n'
       '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
       '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap">\n'
       '<style>' + style + '</style>\n' + body)
pathlib.Path(sys.argv[1]).write_text(out)
print(f'wrote {sys.argv[1]} ({len(out)} bytes)')
