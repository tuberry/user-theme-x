// vim:fdm=syntax
// by tuberry
/* exported getThemeDirs getModeThemeDirs checkFile getAllThemes */
'use strict';

const { Gio, GLib, Gtk } = imports.gi;

const noop = () => {};
const fn = (...args) => GLib.build_filenamev(args);

Gio._promisify(Gio.File.prototype, 'query_info_async');
Gio._promisify(Gio.File.prototype, 'enumerate_children_async');

function checkFile(file) {
    return file.query_info_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null);
}

function getDirs(type) {
    return [
        fn(GLib.get_home_dir(), `.${type}`),
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
        let files = [];
        for await (let info of await Gio.File.new_for_path(path).enumerate_children_async(Gio.FILE_ATTRIBUTE_STANDARD_NAME, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null).catch(noop) ?? []) files.push({ name: info.get_name(), path });
        return files;
    }));
}

async function getThemes(type) {
    return (await enumerateDirs(getDirs(type))).flat().map(({ name, path }) => ({ name, path: `${path}/${name}` }));
}

async function getModeThemes() {
    return (await enumerateDirs(getModeThemeDirs())).flat().flatMap(({ name }) => name.endsWith('.css') ? [name.slice(0, -4)] : []);
}

async function getAllThemes() {
    let icons = await getThemes('icons'),
        themes = await getThemes('themes'),
        modes = await getModeThemes(),
        check = (...x) => checkFile(Gio.File.new_for_path(fn(...x))).catch(noop),
        ret = await Promise.all([
        // Ref: https://gitlab.gnome.org/GNOME/gnome-tweaks/-/blob/master/gtweak/tweaks/tweak_group_appearance.py
            themes.map(async ({ name, path }) => await check(path, 'gtk-3.0', 'gtk.css') ||
                   await check(path, `gtk-3.${Math.ceil(Gtk.MINOR_VERSION / 2) * 2}`, 'gtk.css') ? [name] : []).concat('HighContrastInverse'),
            themes.map(async ({ name, path }) => await check(path, 'gnome-shell', 'gnome-shell.css') ? [name] : []).concat(modes, 'Default'),
            icons.map(async ({ name, path }) => await check(path, 'icon-theme.cache') ? [name] : []),
            icons.map(async ({ name, path }) => await check(path, 'cursors') ? [name] : []),
        ].map(x => Promise.all(x)));
    return ret.map(x => [...new Set(x.flat())].sort());
}
