// vim:fdm=syntax
// by tuberry
/* exported getThemeDirs getModeThemeDirs checkFile getAllThemes */
'use strict';

const { Gio, GLib, Gtk } = imports.gi;

const noop = () => {};
const fn = (...args) => GLib.build_filenamev(args);

Gio._promisify(Gio.File.prototype, 'query_info_async');
Gio._promisify(Gio.File.prototype, 'enumerate_children_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async');

function checkFile(file) {
    return file.query_info_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null);
}

function getDirs(type) {
    return [
        fn(GLib.get_home_dir(), '.%s'.format(type)),
        fn(GLib.get_user_data_dir(), type),
        ...GLib.get_system_data_dirs().map(dir => fn(dir, type)),
    ];
}

function getThemeDirs() {
    return getDirs('themes');
}

function getModeThemeDirs() {
    return GLib.get_system_data_dirs().map(dir => fn(dir, 'gnome-shell', 'theme'));
}

function enumerateDirs(dirs) {
    return Promise.all(dirs.map(async path => {
        let infos, files = [];
        let denum = await Gio.File.new_for_path(path).enumerate_children_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null).catch(noop);
        while((infos = await denum?.next_files_async(100, GLib.PRIORITY_DEFAULT, null))?.length) files.push(...infos);
        return files.map(x => ({ info: x, path }));
    }));
}

async function getThemes(type) {
    return (await enumerateDirs(getDirs(type))).flat().map(x => (y => ({ name: y, path: '%s/%s'.format(x.path, y) }))(x.info.get_name()));
}

async function getModeThemes() {
    return (await enumerateDirs(getModeThemeDirs())).flat().flatMap(x => (y => y.endsWith('.css') ? [y.slice(0, -4)] : [])(x.info.get_name()));
}

async function getAllThemes() {
    let icons = await getThemes('icons');
    let themes = await getThemes('themes');
    let mode_themes = await getModeThemes();
    let check = (...x) => checkFile(Gio.File.new_for_path(fn(...x))).catch(noop);
    let result = await Promise.all([
        // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
        themes.map(async t => await check(t.path, 'gtk-3.0', 'gtk.css') ||
                   await check(t.path, 'gtk-3.%d'.format(Math.ceil(Gtk.MINOR_VERSION / 2) * 2), 'gtk.css') ? [t.name] : []).concat('HighContrastInverse'),
        themes.map(async t => await check(t.path, 'gnome-shell', 'gnome-shell.css') ? [t.name] : []).concat(mode_themes, 'Default'),
        icons.map(async t => await check(t.path, 'icon-theme.cache') ? [t.name] : []),
        icons.map(async t => await check(t.path, 'cursors') ? [t.name] : []),
    ].map(x => Promise.all(x)));

    return result.map(x => [...new Set(x.flat())].sort());
}
