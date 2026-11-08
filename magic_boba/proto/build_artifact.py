#!/usr/bin/env python3
"""Bundle play.html and its local scripts into one self-contained page for a Claude Artifact.

Usage: python3 build_artifact.py OUT.html
"""
import pathlib
import re
import sys

here = pathlib.Path(__file__).parent
html = (here / 'play.html').read_text()

style = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)


def sub(old, new):
    global style
    assert old in style, old
    style = style.replace(old, new)


# Artifact page contract: safe-area side gutters, focus rings. Skins set their own color-scheme.
sub('padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);',
    'padding-block: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); '
    'padding-right: max(16px, env(safe-area-inset-right, 0px));')
style += ('  button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n'
          '  @media (prefers-reduced-motion: reduce) { .cup { transition: none; } }\n')

# inline every local script (engine, levels, audio, fx)
body = re.sub(r'<script src="([\w.-]+)"></script>',
              lambda m: '<script>\n' + (here / m.group(1)).read_text() + '\n</script>', body)
assert '<script src=' not in body

out = ('<title>Magic Boba</title>\n'
       '<meta name="claude:viewport-fit-sides" content="cover">\n'
       '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
       '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Cinzel:wght@600;700&family=Fredoka:wght@400;600;700&display=swap">\n'
       '<style>' + style + '</style>\n' + body)
pathlib.Path(sys.argv[1]).write_text(out)
print(f'wrote {sys.argv[1]} ({len(out)} bytes)')
