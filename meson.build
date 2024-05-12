project(
  'gnome-shell-extension-user-theme-x',
  license: 'LGPL-3.0-or-later',
  version: '46.1',
)

_name = meson.project_name().replace('gnome-shell-extension-', '')
_version = get_option('version')
metadata = {
    'name': 'User Theme X',
    'uuid': _name + '@tuberry.github.io',
    'gettext': meson.project_name(),
    'shell': meson.project_version().split('.')[0],
    'url': 'https://github.com/tuberry' / _name,
    'schemas': 'org.gnome.shell.extensions.' + _name,
    'version': (_version != 0) ? _version : run_command('cli/get-version.sh', check: true, env: ['EGO=3019' / 'user-themes-x']).stdout().strip(),
    'description': 'Customizable user-theme with user stylesheet and dark theme auto-switch based on the Night Light'
      + '\\n\\nFor support, please report any issues via the homepage link below.',
}

fs = import('fs')
i18n = import('i18n')
gnome = import('gnome')

target = get_option('target')
datadir = get_option('datadir')
if(target == 'system')
  locale_dir = get_option('localedir')
  schema_dir = datadir / 'glib-2.0' / 'schemas'
  target_dir = datadir / 'gnome-shell' / 'extensions' / metadata['uuid']
else
  target_root = (target == 'local') ? fs.expanduser('~/.local/share/gnome-shell/extensions/') : meson.project_build_root()
  target_dir = target_root / metadata['uuid']
  locale_dir = target_dir / 'locale'
  schema_dir = target_dir / 'schemas'
endif

if(target == 'zip')
  zip_dir = get_option('desktop') ? fs.expanduser('~/Desktop') : target_root
  meson.add_install_script(
    find_program('7z'),
    'a',
    zip_dir / '@0@_v@1@.zip'.format(metadata['gettext'], metadata['version']),
    target_dir / '*'
  )
endif

subdir('po')
subdir('res')
install_subdir('src', install_dir: target_dir, strip_directory: true)
